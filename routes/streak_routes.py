from flask import Blueprint, request, jsonify, session
from services.streak_service import db_advance_clue, db_make_guess
from services.state_service import get_state_json
from database.connection import get_db_connection

streak_bp = Blueprint('streak_bp', __name__)

@streak_bp.route('/api/streak/next-clue', methods=['POST'])
def next_clue():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    db_advance_clue(user_id)
    return jsonify(get_state_json(user_id))

@streak_bp.route('/api/streak/guess', methods=['POST'])
def guess():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    data = request.json or {}
    guess_val = data.get('guess', '').strip()

    if not guess_val:
        return jsonify({'error': 'Guess word is empty.'}), 400

    solved, correct = db_make_guess(user_id, guess_val)
    if solved is None:
        return jsonify({'error': 'Streak status not found.'}), 404

    return jsonify({
        'state': get_state_json(user_id),
        'correct': correct
    })

@streak_bp.route('/api/streak/question', methods=['GET'])
def get_streak_question():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, question FROM cards ORDER BY RANDOM() LIMIT 1")
    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({
            'card_id': 'fallback',
            'question': 'What is the primary energy currency produced by mitochondria?'
        })

    return jsonify({
        'card_id': row['id'],
        'question': row['question']
    })

@streak_bp.route('/api/streak/answer', methods=['POST'])
def submit_streak_answer():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    data = request.json or {}
    card_id = data.get('card_id')
    answer = data.get('answer', '').strip()

    if not card_id or not answer:
        return jsonify({'error': 'card_id and answer are required.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    if card_id == 'fallback':
        real_answer = 'ATP (Adenosine Triphosphate)'
    else:
        cursor.execute("SELECT answer FROM cards WHERE id = ?", (card_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return jsonify({'error': 'Question not found.'}), 404
        real_answer = row['answer']

    def check_streak_answer(user_ans, real_ans):
        user_clean = user_ans.strip().lower()
        real_clean = real_ans.strip().lower()
        
        if not user_clean:
            return False
        if len(user_clean) < 3:
            return False
        
        stop_words = {'and', 'the', 'for', 'with', 'what', 'who', 'how', 'why', 'are', 'not', 'you', 'this', 'that', 'but', 'have', 'from', 'oop', 'java'}
        if user_clean in stop_words:
            return False

        if user_clean == real_clean:
            return True
            
        import re
        user_words = set(re.findall(r'\b\w{3,}\b', user_clean))
        real_words = set(re.findall(r'\b\w{3,}\b', real_clean))
        
        user_words = user_words - stop_words
        real_words = real_words - stop_words
        
        if not real_words:
            return user_clean in real_clean
            
        if not user_words:
            return False
            
        if user_words.issubset(real_words):
            return True
            
        matches = user_words.intersection(real_words)
        if len(matches) / len(real_words) >= 0.5:
            return True
            
        return False

    correct = check_streak_answer(answer, real_answer)

    if correct:
        from services.streak_service import record_study_activity
        record_study_activity(user_id)

    conn.close()

    return jsonify({
        'correct': correct,
        'solution': real_answer,
        'state': get_state_json(user_id)
    })

@streak_bp.route('/api/streak/solution', methods=['GET'])
def get_streak_solution():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    card_id = request.args.get('card_id')
    if not card_id:
        return jsonify({'error': 'card_id is required.'}), 400

    if card_id == 'fallback':
        real_answer = 'ATP (Adenosine Triphosphate)'
    else:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT answer FROM cards WHERE id = ?", (card_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return jsonify({'error': 'Question not found.'}), 404
        real_answer = row['answer']

    return jsonify({
        'solution': real_answer
    })
