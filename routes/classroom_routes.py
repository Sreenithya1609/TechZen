from flask import Blueprint, request, jsonify, session
from services.classroom_service import db_create_classroom, db_join_classroom, db_delete_classroom
from services.state_service import get_state_json
from services.auth_middleware import require_role
from database.connection import get_db_connection

classroom_bp = Blueprint('classroom_bp', __name__)

@classroom_bp.route('/api/classrooms', methods=['POST'])
@require_role('teacher', 'admin')
def create_classroom():
    user_id = session.get('user_id')
    data = request.json or {}
    name = data.get('name', '').strip()
    subject = data.get('subject', '').strip()

    if not name or not subject:
        return jsonify({'error': 'Course title and subject are required.'}), 400

    classroom_id, error = db_create_classroom(user_id, name, subject)
    if error:
        return jsonify({'error': error}), 400

    return jsonify(get_state_json(user_id))

@classroom_bp.route('/api/classrooms/join', methods=['POST'])
def join_classroom():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Authentication required. Please sign in.'}), 401

    data = request.json or {}
    code = data.get('code', '').strip().upper()

    if not code:
        return jsonify({'error': 'Classroom access code is required.'}), 400

    classroom_id, error = db_join_classroom(user_id, code)
    if error:
        return jsonify({'error': error}), 400

    return jsonify(get_state_json(user_id))

@classroom_bp.route('/api/classrooms/<classroom_id>', methods=['DELETE'])
@require_role('teacher', 'admin')
def delete_classroom(classroom_id):
    user_id = session.get('user_id')
    success, error = db_delete_classroom(user_id, classroom_id)
    if not success:
        return jsonify({'error': error or 'Failed to delete classroom.'}), 403 if 'Forbidden' in (error or '') else 404

    return jsonify(get_state_json(user_id))

@classroom_bp.route('/api/classrooms/<classroom_id>/diagnosis', methods=['GET'])
@require_role('teacher', 'admin')
def get_classroom_diagnosis(classroom_id):
    """
    Feature 5: Classroom Performance Diagnosis & AI Pedagogical Insights.
    Accessible to classroom instructor and administrators.
    """
    user_id = session.get('user_id')
    conn = get_db_connection()
    user = conn.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
    classroom = conn.execute("SELECT id, teacher_id FROM classrooms WHERE id = ?", (classroom_id,)).fetchone()
    conn.close()

    if not classroom:
        return jsonify({'success': False, 'error': 'Classroom not found.'}), 404

    if user['role'] not in ('teacher', 'admin'):
        return jsonify({
            'success': False,
            'error': 'Forbidden: You are not authorized to access performance diagnosis for this classroom.'
        }), 403

    from services.diagnosis_service import generate_ai_classroom_diagnosis
    report, err = generate_ai_classroom_diagnosis(classroom_id)
    if err:
        return jsonify({'success': False, 'error': err}), 400

    return jsonify({
        'success': True,
        'data': report
    }), 200
