from flask import Blueprint, jsonify, session
from database.connection import get_db_connection
from services.streak_service import record_study_activity
from services.state_service import get_state_json

progress_bp = Blueprint('progress_bp', __name__)

@progress_bp.route('/api/progress/study', methods=['POST'])
def record_study():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401
    
    # Record daily study action
    record_study_activity(user_id)
    
    # Return the updated state
    return jsonify(get_state_json(user_id))

@progress_bp.route('/api/progress', methods=['GET'])
def get_progress():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT u.id, u.name, u.email, c.name as course, ce.completed_decks, ce.mark
        FROM classroom_enrollments ce
        JOIN users u ON ce.student_id = u.id
        JOIN classrooms c ON ce.classroom_id = c.id
        WHERE u.id = ?
    ''', (user_id,))
    rows = cursor.fetchall()
    conn.close()
    
    progress = [
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
        'data': progress
    })
