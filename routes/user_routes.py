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
        return jsonify({'error': 'Name, email, and password are required.'}), 400

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
        return jsonify({'error': 'Invalid email or password.'}), 401

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
        return jsonify({'error': 'Not logged in'}), 401

    data = request.json or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()

    if not name or not email:
        return jsonify({'error': 'Name and email cannot be empty.'}), 400

    success, error = db_update_profile(user_id, name, email, password)
    if not success:
        return jsonify({'error': error}), 400

    return jsonify(get_state_json(user_id))

@user_bp.route('/api/auth/theme', methods=['PUT'])
def update_theme():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    data = request.json or {}
    theme = data.get('theme', 'light')

    db_update_theme(user_id, theme)
    return jsonify({'success': True})

@user_bp.route('/api/students/<student_id>/progress', methods=['GET'])
def get_student_progress(student_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    conn = get_db_connection()
    current_user = conn.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
    if not current_user or current_user['role'] != 'teacher':
        conn.close()
        return jsonify({'error': 'Forbidden: Only teachers can view specific student progress.'}), 403

    cursor = conn.cursor()
    cursor.execute('''
        SELECT u.id, u.name, u.email, c.name as course, ce.completed_decks, ce.mark
        FROM classroom_enrollments ce
        JOIN users u ON ce.student_id = u.id
        JOIN classrooms c ON ce.classroom_id = c.id
        WHERE u.id = ?
    ''', (student_id,))
    rows = cursor.fetchall()
    conn.close()

    progress_list = [
        {
            'id': r['id'],
            'name': r['name'],
            'email': r['email'],
            'course': r['course'],
            'completedDecks': r['completed_decks'],
            'mark': r['mark']
        } for r in rows
    ]

    return jsonify({
        'success': True,
        'progress': progress_list
    })
