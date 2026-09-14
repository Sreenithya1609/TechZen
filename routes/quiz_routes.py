"""
Quiz routes blueprint for practice quiz generation from flashcards.
Endpoint: POST /api/decks/<deck_id>/generate-quiz
"""

from flask import Blueprint, jsonify, session
from services.quiz_service import generate_quiz_from_deck

quiz_bp = Blueprint('quiz_bp', __name__)

@quiz_bp.route('/api/decks/<deck_id>/generate-quiz', methods=['POST'])
def generate_quiz(deck_id):
    """
    Transforms flashcard questions into a multiple-choice practice quiz with plausible distractors.
    """
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({
            'success': False,
            'error': 'Authentication required. Please sign in.'
        }), 401

    quiz_data, error_msg, status_code = generate_quiz_from_deck(deck_id, user_id)
    if error_msg:
        return jsonify({
            'success': False,
            'error': error_msg
        }), status_code

    return jsonify({
        'success': True,
        'data': quiz_data
    }), 200
