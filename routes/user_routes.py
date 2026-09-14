import os
import re
import uuid
from datetime import datetime
import json
from urllib.parse import urlencode
from urllib import error as urllib_error
from urllib import request as urllib_request
from flask import Blueprint, request, jsonify, session, redirect, url_for, current_app
from werkzeug.security import generate_password_hash, check_password_hash
from database.connection import get_db_connection
from services.auth_middleware import require_role
from services.user_service import (
    db_register_user, db_login_user, db_update_profile, db_update_theme,
    create_auth_token, consume_auth_token, db_set_password_from_reset,
    db_find_or_create_google_user, db_change_password, send_auth_email,
    db_google_auth, db_request_teacher_access, EMAIL_REGEX, record_user_login
)
from services.state_service import get_state_json, calculate_student_subject_performance

user_bp = Blueprint('user_bp', __name__)

def error_response(code, message, status_code=400):
    return jsonify({
        'error': message,
        'code': code,
        'message': message
    }), status_code

@user_bp.route('/api/auth/google/config', methods=['GET'])
def google_config():
    client_id = os.environ.get('GOOGLE_CLIENT_ID', '').strip()
    if not client_id:
        try:
            from dotenv import load_dotenv
            load_dotenv(override=True)
            client_id = os.environ.get('GOOGLE_CLIENT_ID', '').strip()
        except Exception:
            pass
    return jsonify({
        'clientId': client_id,
        'configured': bool(client_id)
    })

@user_bp.route('/api/auth/google', methods=['POST'])
def google_auth():
    data = request.json or {}
    credential = data.get('credential')
    access_token = data.get('access_token')

    if not credential and not access_token:
        return jsonify({'error': 'Google authentication token is missing.'}), 400

    # Quick demo verification fallback (for testing before user enters their OAuth Client ID)
    if credential == 'demo-google-token':
        demo_email = data.get('demo_email', 'scholar.google@domain.edu').strip().lower()
        demo_name = data.get('demo_name', 'Scholar Vance').strip()
        user_id, error = db_google_auth(demo_email, demo_name)
        if error:
            return jsonify({'error': error}), 400
        session['user_id'] = user_id
        return jsonify(get_state_json(user_id))

    email = None
    name = None
    picture = None
    google_id = None

    try:
        if credential:
            # Verify Google JWT ID Token via Google's official tokeninfo endpoint
            verify_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}"
            req = urllib_request.Request(verify_url, headers={'User-Agent': 'FlashLearn-App'})
            with urllib_request.urlopen(req, timeout=10) as resp:
                token_info = json.loads(resp.read().decode('utf-8'))

            configured_client_id = os.environ.get('GOOGLE_CLIENT_ID', '').strip()
            if configured_client_id and token_info.get('aud') != configured_client_id:
                return jsonify({'error': 'Security check failed: Google Client ID mismatch.'}), 403

            email = token_info.get('email')
            name = token_info.get('name') or token_info.get('given_name')
            picture = token_info.get('picture')
            google_id = token_info.get('sub')
            email_verified = token_info.get('email_verified')
            if str(email_verified).lower() not in ('true', '1'):
                return jsonify({'error': 'Google email address is not verified.'}), 400

        elif access_token:
            # Verify Access Token via UserInfo endpoint
            userinfo_url = "https://www.googleapis.com/oauth2/v3/userinfo"
            req = urllib_request.Request(userinfo_url, headers={
                'Authorization': f'Bearer {access_token}',
                'User-Agent': 'FlashLearn-App'
            })
            with urllib_request.urlopen(req, timeout=10) as resp:
                token_info = json.loads(resp.read().decode('utf-8'))

            email = token_info.get('email')
            name = token_info.get('name')
            picture = token_info.get('picture')
            google_id = token_info.get('sub')
            email_verified = token_info.get('email_verified')
            if str(email_verified).lower() not in ('true', '1'):
                return jsonify({'error': 'Google email address is not verified.'}), 400

    except urllib_error.HTTPError as e:
        return jsonify({'error': f'Google token validation error: {e.reason}'}), 401
    except Exception as e:
        return jsonify({'error': f'Failed to verify with Google servers: {str(e)}'}), 500

    if not email:
        return jsonify({'error': 'Unable to retrieve user email from Google.'}), 400

    user_id, error = db_google_auth(email, name, picture=picture, google_id=google_id)
    if error:
        return jsonify({'error': error}), 400

    session['user_id'] = user_id
    record_user_login(user_id, request.remote_addr, request.headers.get('User-Agent'))
    return jsonify(get_state_json(user_id))

@user_bp.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return error_response("INVALID_INPUT", "Request body must be a valid JSON object")

    # Step 2.2 — Validate registration data (check types before using .strip())
    # 1. Validate Name
    name = data.get("name")
    if not isinstance(name, str):
        return error_response("INVALID_NAME", "Name must be a string")
    name = name.strip()
    if not name:
        return error_response("INVALID_NAME", "Full name is required.")
    if len(name) < 2:
        return error_response("INVALID_NAME", "Full name must be at least 2 characters long.")
    if len(name) > 80:
        return error_response("INVALID_NAME", "Full name cannot exceed 80 characters.")

    # 2. Validate Email
    email = data.get("email")
    if not isinstance(email, str):
        return error_response("INVALID_EMAIL", "Email must be a string")
    email = email.strip()
    if not email:
        return error_response("INVALID_EMAIL", "Email address is required.")
    if not EMAIL_REGEX.match(email):
        return error_response("INVALID_EMAIL", "Please enter a valid email address.")
    if len(email) > 120:
        return error_response("INVALID_EMAIL", "Email address is too long.")
    email = email.lower()

    # 3. Validate Password
    password = data.get("password")
    if not isinstance(password, str):
        return error_response("INVALID_PASSWORD", "Password must be a string")
    if not password:
        return error_response("INVALID_PASSWORD", "Password is required.")
    if len(password) < 6:
        return error_response("INVALID_PASSWORD", "Password must be at least 6 characters long.")
    if not any(c.isalpha() for c in password):
        return error_response("INVALID_PASSWORD", "Password must contain at least one letter.")
    if not any(c.isdigit() for c in password):
        return error_response("INVALID_PASSWORD", "Password must contain at least one number.")
    if not any(not c.isalnum() and not c.isspace() for c in password):
        return error_response("INVALID_PASSWORD", "Password must contain at least one symbol.")

    confirm_password = data.get("confirm_password")
    if confirm_password is not None:
        if not isinstance(confirm_password, str):
            return error_response("INVALID_CONFIRM_PASSWORD", "Confirm password must be a string")
        if password != confirm_password.strip():
            return error_response("PASSWORD_MISMATCH", "Password and confirmation password must match.")

    # 4. Validate Role
    role = data.get("role", "student")
    if role is None:
        role = "student"
    if not isinstance(role, str):
        return error_response("INVALID_ROLE", "Role must be a string")
    role = role.strip().lower()
    if role not in ["student", "teacher", "admin"]:
        return error_response("INVALID_ROLE", "Role must be either 'student' or 'teacher'")

    # Step 2.1 — Check Duplicate Email
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
    existing = cursor.fetchone()
    if existing:
        conn.close()
        return error_response("EMAIL_EXISTS", "An account with this email already exists.")

    # Step 2.3 — Hash Password
    hashed_pwd = generate_password_hash(password)

    # Step 2.1 — Create User & Assign Role
    user_id = f"usr-{int(uuid.uuid4().time_low)}"
    now_iso = datetime.utcnow().isoformat()

    if role == "teacher":
        assigned_role = "student"
        teacher_status = "pending"
    else:
        # standard student or attempted admin escalation defaults to student
        assigned_role = "student"
        teacher_status = "none"

    cursor.execute(
        "INSERT INTO users (id, name, email, password, role, teacher_status, email_verified_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (user_id, name, email, hashed_pwd, assigned_role, teacher_status, now_iso, now_iso)
    )

    if teacher_status == "pending":
        app_id = f"app-{int(uuid.uuid4().time_low)}"
        cursor.execute(
            "INSERT INTO teacher_applications (id, user_id, status, submitted_at) VALUES (?, ?, 'pending', ?)",
            (app_id, user_id, now_iso)
        )

    conn.commit()
    conn.close()

    # Step 2.1 — Return Response (passwords never returned)
    session.clear()
    session['user_id'] = user_id
    session.permanent = True
    record_user_login(user_id, request.remote_addr, request.headers.get('User-Agent'))
    state = get_state_json(user_id)
    if teacher_status == 'pending':
        state['message'] = 'Account created with Teacher application submitted for Admin review!'
    else:
        state['message'] = 'Account created successfully. Welcome!'
    return jsonify(state), 200

@user_bp.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()

    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400

    user_id = db_login_user(email, password)
    if not user_id:
        return jsonify({'error': 'Invalid email address or password.'}), 401

    conn = get_db_connection()
    user = conn.execute("SELECT email_verified_at, google_sub FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if user and not user['email_verified_at'] and not user['google_sub']:
        return jsonify({'error': 'Please verify your email before signing in.'}), 403
    session.clear()
    session['user_id'] = user_id
    session.permanent = True
    record_user_login(user_id, request.remote_addr, request.headers.get('User-Agent'))
    return jsonify(get_state_json(user_id)), 200

@user_bp.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify(get_state_json(None))

@user_bp.route('/api/teacher/request', methods=['POST'])
def request_teacher_access():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Authentication required. Please sign in.'}), 401

    status, error = db_request_teacher_access(user_id)
    if error:
        return jsonify({'error': error}), 400

    return jsonify({
        'message': 'Teacher request submitted successfully',
        'teacher_status': status
    }), 200

@user_bp.route('/api/auth/verify-email', methods=['GET'])
def verify_email():
    user_id = consume_auth_token(request.args.get('token', ''), 'email_verification')
    if not user_id:
        return jsonify({'error': 'This verification link is invalid or expired.'}), 400
    return jsonify({'success': True, 'message': 'Email verified. You can now sign in.'})

@user_bp.route('/api/auth/resend-verification', methods=['POST'])
def resend_verification():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    conn = get_db_connection()
    user = conn.execute("SELECT id, email_verified_at FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    response = {'success': True, 'message': 'If that account exists and needs verification, a new link has been sent.'}
    if user and not user['email_verified_at']:
        token = create_auth_token(user['id'], 'email_verification')
        verification_link = url_for('user_bp.verify_email', token=token, _external=True)
        send_auth_email(email, 'Verify your FlashLearn email', verification_link, 'Verify your FlashLearn account:')
        if current_app.config.get('ENV') != 'production':
            response['dev_verification_link'] = verification_link
    return jsonify(response)

@user_bp.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    email = (request.json or {}).get('email', '').strip().lower()
    conn = get_db_connection()
    user = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    response = {'success': True, 'message': 'If that account exists, password reset instructions have been sent.'}
    if user:
        token = create_auth_token(user['id'], 'password_reset', 1)
        reset_link = url_for('index', reset_token=token, _external=True)
        send_auth_email(email, 'Reset your FlashLearn password', reset_link, 'Reset your FlashLearn password:')
        if current_app.config.get('ENV') != 'production':
            response['dev_reset_link'] = reset_link
    return jsonify(response)

@user_bp.route('/api/auth/reset-password', methods=['GET', 'POST'])
def reset_password():
    if request.method == 'GET':
        return redirect('/?reset_token=' + request.args.get('token', ''))
    data = request.json or {}
    token = data.get('token', '')
    password = data.get('password', '').strip()
    confirm_password = data.get('confirm_password', '').strip()
    if password != confirm_password:
        return jsonify({'error': 'Password and confirmation password must match.'}), 400
    from services.user_service import validate_user_input
    validation_error = validate_user_input('Valid User', 'user@example.com', password, is_registration=True)
    if validation_error:
        return jsonify({'error': validation_error}), 400
    user_id = consume_auth_token(token, 'password_reset')
    if not user_id:
        return jsonify({'error': 'This reset link is invalid or expired.'}), 400
    success, error = db_set_password_from_reset(user_id, password)
    if not success:
        return jsonify({'error': error}), 400
    return jsonify({'success': True, 'message': 'Password reset successfully. You can now sign in.'})

@user_bp.route('/api/auth/change-password', methods=['PUT'])
def change_password():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Authentication required.'}), 401
    data = request.json or {}
    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')
    confirm_password = data.get('confirm_password', '')
    if new_password != confirm_password:
        return jsonify({'error': 'Password and confirmation password must match.'}), 400
    conn = get_db_connection()
    user = conn.execute("SELECT email FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if not user or db_login_user(user['email'], current_password) != user_id:
        return jsonify({'error': 'Current password is incorrect.'}), 400
    success, error = db_change_password(user_id, new_password)
    if not success:
        return jsonify({'error': error}), 400
    return jsonify({'success': True, 'message': 'Password changed successfully.'})

@user_bp.route('/api/auth/google')
def google_login():
    client_id = current_app.config.get('GOOGLE_CLIENT_ID')
    if not client_id or not current_app.config.get('GOOGLE_CLIENT_SECRET'):
        return jsonify({'error': 'Google login is not configured on this server.'}), 503
    session['oauth_next'] = request.args.get('next', '/')
    redirect_uri = url_for('user_bp.google_callback', _external=True)
    params = {'client_id': client_id, 'redirect_uri': redirect_uri, 'response_type': 'code', 'scope': 'openid email profile', 'access_type': 'offline', 'prompt': 'select_account'}
    return redirect('https://accounts.google.com/o/oauth2/v2/auth?' + urlencode(params))

@user_bp.route('/api/auth/google/callback')
def google_callback():
    # Token exchange and ID-token signature verification should use Authlib in deployment.
    from authlib.integrations.requests_client import OAuth2Session
    code = request.args.get('code')
    if not code:
        return jsonify({'error': 'Google authentication was cancelled or failed.'}), 400
    client = OAuth2Session(current_app.config['GOOGLE_CLIENT_ID'], current_app.config['GOOGLE_CLIENT_SECRET'], scope='openid email profile')
    token = client.fetch_token('https://oauth2.googleapis.com/token', code=code, redirect_uri=url_for('user_bp.google_callback', _external=True))
    userinfo = client.get('https://openidconnect.googleapis.com/v1/userinfo').json()
    if not userinfo.get('sub') or not userinfo.get('email'):
        return jsonify({'error': 'Google did not return a usable account.'}), 400
    user_id, error = db_find_or_create_google_user(userinfo['sub'], userinfo['email'], userinfo.get('name', 'Google User'))
    if error:
        return jsonify({'error': error}), 400
    session.clear()
    session['user_id'] = user_id
    session.permanent = True
    return redirect(session.pop('oauth_next', '/'))

@user_bp.route('/api/auth/profile', methods=['PUT'])
def update_profile():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Authentication required. Please sign in.'}), 401

    data = request.json or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()

    if not name or not email:
        return jsonify({'error': 'Name and email cannot be empty.'}), 400

    success, error = db_update_profile(user_id, name, email, password if password else None)
    if not success:
        return jsonify({'error': error}), 400

    return jsonify(get_state_json(user_id))

@user_bp.route('/api/auth/theme', methods=['PUT'])
def update_theme():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Authentication required.'}), 401

    data = request.json or {}
    theme = data.get('theme', 'light')

    db_update_theme(user_id, theme)
    return jsonify({'success': True, 'theme': theme})

@user_bp.route('/api/students/<student_id>/progress', methods=['GET'])
@require_role('teacher', 'admin')
def get_student_progress(student_id):
    user_id = session.get('user_id')
    conn = get_db_connection()

    cursor = conn.cursor()
    cursor.execute('''
        SELECT u.id, u.name, u.email, c.id as classroom_id, c.name as course, c.subject, ce.completed_decks
        FROM classroom_enrollments ce
        JOIN users u ON ce.student_id = u.id
        JOIN classrooms c ON ce.classroom_id = c.id
        WHERE u.id = ?
    ''', (student_id,))
    rows = cursor.fetchall()
    
    if not rows:
        cursor.execute("SELECT id, name, email FROM users WHERE id = ?", (student_id,))
        u = cursor.fetchone()
        if u:
            student_name = u['name']
            student_email = u['email']
            average_mark = 0
            completed_decks = 0
            enrolled_classes = []
            subjects_perf = []
            lagging_subjects = []
        else:
            conn.close()
            return jsonify({'error': 'Student not found.'}), 404
    else:
        student_name = rows[0]['name']
        student_email = rows[0]['email']
        total_mark = 0
        enrolled_classes = []
        for r in rows:
            cls_id = r['classroom_id']
            cursor.execute('''
                SELECT COUNT(*) FROM card_attempts 
                WHERE user_id = ? AND classroom_id = ? AND result = 'known'
            ''', (student_id, cls_id))
            stu_known = cursor.fetchone()[0] or 0
            
            cursor.execute('''
                SELECT COUNT(*) FROM card_attempts 
                WHERE user_id = ? AND classroom_id = ?
            ''', (student_id, cls_id))
            stu_total = cursor.fetchone()[0] or 0
            
            stu_mark = round((stu_known / stu_total) * 100) if stu_total > 0 else 0
            total_mark += stu_mark
            enrolled_classes.append({
                'name': r['course'],
                'subject': r['subject'],
                'mark': stu_mark
            })
        average_mark = int(round(total_mark / len(rows))) if rows else 0
        completed_decks = sum(r['completed_decks'] for r in rows)
        
        overall_acc, subjects_perf = calculate_student_subject_performance(cursor, student_id)
        lagging_subjects = [sub['subject'] for sub in subjects_perf if sub['status'] == 'LAGGING']

    conn.close()

    return jsonify({
        'success': True,
        'student_id': student_id,
        'student_name': student_name,
        'student_email': student_email,
        'average_mark': average_mark,
        'completed_decks': completed_decks,
        'enrolled_classes': enrolled_classes,
        'subjects': subjects_perf,
        'laggingSubjects': lagging_subjects
    })

@user_bp.route('/api/teacher/student-performance', methods=['GET'])
@require_role('teacher', 'admin')
def get_all_student_performance():
    conn = get_db_connection()

    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT u.id, u.name, u.email FROM classroom_enrollments ce JOIN users u ON ce.student_id = u.id ORDER BY u.name ASC")
    students = cursor.fetchall()

    result = []
    for s in students:
        stu_id = s['id']
        overall_acc, subjects_perf = calculate_student_subject_performance(cursor, stu_id)
        lagging_list = [sub['subject'] for sub in subjects_perf if sub['status'] == 'LAGGING']
        result.append({
            'studentId': stu_id,
            'studentName': s['name'],
            'studentEmail': s['email'],
            'overallAccuracy': overall_acc,
            'subjects': subjects_perf,
            'laggingSubjects': lagging_list
        })

    conn.close()
    return jsonify(result)
