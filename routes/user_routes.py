import os
import json
from urllib import error as urllib_error
from urllib import request as urllib_request
from flask import Blueprint, request, jsonify, session
from database.connection import get_db_connection
from services.user_service import db_register_user, db_login_user, db_update_profile, db_update_theme, db_google_auth
from services.state_service import get_state_json, calculate_student_subject_performance

user_bp = Blueprint('user_bp', __name__)

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
    return jsonify(get_state_json(user_id))

@user_bp.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()

    if not name or not email or not password:
        return jsonify({'error': 'Full name, email address, and password are required.'}), 400

    user_id, error = db_register_user(name, email, password)
    if error:
        return jsonify({'error': error}), 400

    session['user_id'] = user_id
    return jsonify(get_state_json(user_id))

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

    session['user_id'] = user_id
    return jsonify(get_state_json(user_id))

@user_bp.route('/api/auth/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify(get_state_json(None))


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
