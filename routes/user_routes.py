from flask import Blueprint, request, jsonify, session
from database.connection import get_db_connection
from services.user_service import db_register_user, db_login_user, db_update_profile, db_update_theme
from services.state_service import get_state_json

user_bp = Blueprint('user_bp', __name__)

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

    conn.close()

    return jsonify({
        'success': True,
        'student_name': student_name,
        'student_email': student_email,
        'average_mark': average_mark,
        'completed_decks': completed_decks,
        'enrolled_classes': enrolled_classes
    })
