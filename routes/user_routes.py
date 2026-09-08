import os
from urllib.parse import urlencode
from flask import Blueprint, request, jsonify, session, redirect, url_for, current_app
from database.connection import get_db_connection
from services.user_service import (
    db_register_user, db_login_user, db_update_profile, db_update_theme,
    create_auth_token, consume_auth_token, db_set_password_from_reset,
    db_find_or_create_google_user, db_change_password, send_auth_email
)
from services.state_service import get_state_json, calculate_student_subject_performance

user_bp = Blueprint('user_bp', __name__)

@user_bp.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()
    confirm_password = data.get('confirm_password', '').strip()

    if not name or not email or not password:
        return jsonify({'error': 'Full name, email address, and password are required.'}), 400
    if password != confirm_password:
        return jsonify({'error': 'Password and confirmation password must match.'}), 400

    user_id, error = db_register_user(name, email, password)
    if error:
        return jsonify({'error': error}), 400

    session['user_id'] = user_id
    token = create_auth_token(user_id, 'email_verification')
    verification_link = url_for('user_bp.verify_email', token=token, _external=True)
    send_auth_email(email, 'Verify your FlashLearn email', verification_link, 'Verify your FlashLearn account:')
    response = {'verification_required': True, 'message': 'Account created. Verify your email before signing in.'}
    if current_app.config.get('ENV') != 'production':
        response['dev_verification_link'] = verification_link
    session.clear()
    return jsonify(response), 201

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
    return jsonify(get_state_json(user_id))

@user_bp.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify(get_state_json(None))

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
def get_student_progress(student_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Authentication required.'}), 401

    conn = get_db_connection()
    current_user = conn.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
    if not current_user or current_user['role'] != 'teacher':
        conn.close()
        return jsonify({'error': 'Forbidden: Only faculty administrators can view student reports.'}), 403

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
def get_all_student_performance():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Authentication required.'}), 401

    conn = get_db_connection()
    current_user = conn.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
    if not current_user or current_user['role'] != 'teacher':
        conn.close()
        return jsonify({'error': 'Forbidden: Only faculty administrators can view student performance.'}), 403

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
