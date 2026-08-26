from flask import Blueprint, request, jsonify, session
from services.classroom_service import db_create_classroom, db_join_classroom
from services.state_service import get_state_json

from database.connection import get_db_connection

classroom_bp = Blueprint('classroom_bp', __name__)

@classroom_bp.route('/api/classrooms', methods=['POST'])
def create_classroom():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    conn = get_db_connection()
    user_row = conn.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if not user_row or user_row['role'] != 'teacher':
        return jsonify({'error': 'Forbidden: Only teachers can create classrooms.'}), 403

    data = request.json or {}
    name = data.get('name', '').strip()
    subject = data.get('subject', '').strip()

    if not name or not subject:
        return jsonify({'error': 'Classroom name and subject are required.'}), 400

    classroom_id, error = db_create_classroom(user_id, name, subject)
    if error:
        return jsonify({'error': error}), 400

    return jsonify(get_state_json(user_id))

@classroom_bp.route('/api/classrooms/join', methods=['POST'])
def join_classroom():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    data = request.json or {}
    code = data.get('code', '').strip().upper()

    if not code:
        return jsonify({'error': 'Access code is required.'}), 400

    classroom_id, error = db_join_classroom(user_id, code)
    if error:
        return jsonify({'error': error}), 400

    return jsonify(get_state_json(user_id))
