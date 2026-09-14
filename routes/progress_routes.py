from flask import Blueprint, jsonify, session, request
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
    
    data = request.get_json(silent=True) or {}
    deck_id = data.get('deck_id')
    accuracy = data.get('accuracy')

    if deck_id:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT classroom_id FROM decks WHERE id = ?", (deck_id,))
        deck_row = cursor.fetchone()
        if deck_row and deck_row['classroom_id']:
            classroom_id = deck_row['classroom_id']
            # Get current completed_decks and update it
            cursor.execute("SELECT completed_decks, mark FROM classroom_enrollments WHERE classroom_id = ? AND student_id = ?", (classroom_id, user_id))
            enrollment = cursor.fetchone()
            if enrollment:
                new_completed = enrollment['completed_decks'] + 1
                new_mark = enrollment['mark']
                if accuracy is not None:
                    try:
                        acc_val = int(accuracy)
                        # Rolling average
                        new_mark = int((enrollment['mark'] * enrollment['completed_decks'] + acc_val) / new_completed)
                        new_mark = max(0, min(new_mark, 100))
                    except (ValueError, TypeError):
                        pass
                cursor.execute(
                    "UPDATE classroom_enrollments SET completed_decks = ?, mark = ? WHERE classroom_id = ? AND student_id = ?",
                    (new_completed, new_mark, classroom_id, user_id)
                )
                
                # Also recalculate average performance of the classroom
                cursor.execute("SELECT AVG(mark) FROM classroom_enrollments WHERE classroom_id = ?", (classroom_id,))
                avg_perf_row = cursor.fetchone()
                avg_perf = int(avg_perf_row[0]) if (avg_perf_row and avg_perf_row[0] is not None) else 80
                cursor.execute("UPDATE classrooms SET avg_performance = ? WHERE id = ?", (avg_perf, classroom_id))
                
                conn.commit()
        conn.close()
    
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

@progress_bp.route('/api/study/result', methods=['POST'])
def record_study_result():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401
        
    data = request.get_json(silent=True) or {}
    card_id = data.get('card_id')
    result = data.get('result') # 'known' or 'review'
    
    if not card_id or result not in ('known', 'review'):
        return jsonify({'error': 'card_id and a valid result (known/review) are required.'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Resolve classroom_id for this card
    cursor.execute('''
        SELECT d.classroom_id 
        FROM cards c
        JOIN decks d ON c.deck_id = d.id
        WHERE c.id = ?
    ''', (card_id,))
    card_row = cursor.fetchone()
    classroom_id = card_row['classroom_id'] if card_row else None
    
    # 2. Insert card attempt
    cursor.execute('''
        INSERT INTO card_attempts (user_id, card_id, classroom_id, result)
        VALUES (?, ?, ?, ?)
    ''', (user_id, card_id, classroom_id, result))

    # 2b. Upsert into student_progress table for granular analytics
    prog_id = f"prog-{user_id}-{card_id}"
    is_known = 1 if result == 'known' else 0
    is_review = 1 if result == 'review' else 0
    cursor.execute('''
        INSERT INTO student_progress (id, student_id, flashcard_id, classroom_id, correct_count, incorrect_count, attempts, last_reviewed)
        VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(student_id, flashcard_id) DO UPDATE SET
            correct_count = correct_count + excluded.correct_count,
            incorrect_count = incorrect_count + excluded.incorrect_count,
            attempts = attempts + 1,
            classroom_id = COALESCE(excluded.classroom_id, student_progress.classroom_id),
            last_reviewed = CURRENT_TIMESTAMP
    ''', (prog_id, user_id, card_id, classroom_id, is_known, is_review))
    
    # 3. Log daily study date for streaks (if not already logged today)
    from services.streak_service import record_study_activity
    record_study_activity(user_id)
    
    # 4. If classroom_id exists, recalculate this student's mark for this classroom
    if classroom_id:
        cursor.execute('''
            SELECT COUNT(*) FROM card_attempts 
            WHERE user_id = ? AND classroom_id = ? AND result = 'known'
        ''', (user_id, classroom_id))
        known_count = cursor.fetchone()[0] or 0
        
        cursor.execute('''
            SELECT COUNT(*) FROM card_attempts 
            WHERE user_id = ? AND classroom_id = ?
        ''', (user_id, classroom_id))
        total_count = cursor.fetchone()[0] or 1
        
        new_mark = round((known_count / total_count) * 100)
        
        cursor.execute('''
            UPDATE classroom_enrollments 
            SET mark = ?
            WHERE classroom_id = ? AND student_id = ?
        ''', (new_mark, classroom_id, user_id))
        
        # Recalculate average performance of the classroom (Class Mastery) dynamically
        cursor.execute('''
            SELECT COUNT(*) FROM card_attempts 
            WHERE classroom_id = ? AND result = 'known'
        ''', (classroom_id,))
        class_known = cursor.fetchone()[0] or 0
        
        cursor.execute('''
            SELECT COUNT(*) FROM card_attempts 
            WHERE classroom_id = ?
        ''', (classroom_id,))
        class_total = cursor.fetchone()[0] or 0
        
        class_avg = round((class_known / class_total) * 100) if class_total > 0 else 80
        cursor.execute("UPDATE classrooms SET avg_performance = ? WHERE id = ?", (class_avg, classroom_id))
        
    conn.commit()
    conn.close()
    
    return jsonify(get_state_json(user_id))
