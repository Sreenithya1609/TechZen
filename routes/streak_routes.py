from flask import Blueprint, request, jsonify, session
from services.streak_service import db_advance_clue, db_make_guess
from services.state_service import get_state_json

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
