"""
Flask Blueprint for AI Routes in FlashLearn.
Endpoints:
- POST /api/ai/hint
- POST /api/ai/check-answer
- POST /api/ai/generate
"""

import os
import re
import json
from urllib import error as urllib_error
from urllib import request as urllib_request
from flask import Blueprint, request, jsonify, session
from database.connection import get_db_connection
from utils.validators import validate_string, validate_flashcard_id
from services.ai_service import (
    verify_card_access,
    generate_hint,
    evaluate_student_answer,
    generate_fallback_cards,
    call_gemini_api
)


ai_bp = Blueprint('ai', __name__)

@ai_bp.route('/api/ai/hint', methods=['POST'])
def get_ai_hint():
    """
    Returns a pedagogical Socratic hint for a flashcard question.
    Ensures the exact answer is not revealed.
    """
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({
            'success': False,
            'error': 'Authentication required. Please sign in.'
        }), 401

    data = request.get_json(silent=True) or {}
    flashcard_id, card_id_err = validate_flashcard_id(data, required=False)

    if flashcard_id:
        card, err_msg, status_code = verify_card_access(user_id, flashcard_id)
        if err_msg:
            return jsonify({'success': False, 'error': err_msg}), status_code
        question = card['question']
        answer = card['answer']
    else:
        question, q_err = validate_string(data, 'question', min_length=2, max_length=1000, required=True)
        if q_err:
            return jsonify({'success': False, 'error': q_err}), 400
        answer = None

    hint = generate_hint(question, answer)
    return jsonify({
        'success': True,
        'data': {
            'hint': hint
        }
    }), 200


@ai_bp.route('/api/ai/check-answer', methods=['POST'])
def check_student_answer():
    """
    Semantically evaluates a student's active recall response against expected answer.
    Returns CORRECT, PARTIALLY_CORRECT, or INCORRECT with feedback.
    """
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({
            'success': False,
            'error': 'Authentication required. Please sign in.'
        }), 401

    data = request.get_json(silent=True) or {}
    student_answer, sa_err = validate_string(data, 'student_answer', min_length=1, max_length=3000, required=True)
    if sa_err:
        return jsonify({'success': False, 'error': sa_err}), 400

    flashcard_id, card_id_err = validate_flashcard_id(data, required=False)

    if flashcard_id:
        card, err_msg, status_code = verify_card_access(user_id, flashcard_id)
        if err_msg:
            return jsonify({'success': False, 'error': err_msg}), status_code
        question = card['question']
        expected_answer = card['answer']
    else:
        # Fallback to direct question/answer fields if flashcard_id is not provided
        question, q_err = validate_string(data, 'question', min_length=2, required=True)
        expected_answer, ea_err = validate_string(data, 'correct_answer', min_length=1, required=True)
        if q_err or ea_err:
            return jsonify({'success': False, 'error': q_err or ea_err or 'Question and expected answer required.'}), 400

    eval_result = evaluate_student_answer(question, expected_answer, student_answer)
    return jsonify({
        'success': True,
        'data': eval_result
    }), 200


@ai_bp.route('/api/ai/generate', methods=['POST'])
def generate_ai_flashcards():
    """
    Generates structured flashcards from curriculum topics or raw student notes.
    """
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Authentication required. Please sign in.'}), 401

    conn = get_db_connection()
    user = conn.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if not user:
        return jsonify({'error': 'Forbidden: User session invalid.'}), 403

    data = request.json or {}
    topic = data.get('topic', '').strip()
    level = data.get('level', 'Intermediate Mastery').strip()
    count = data.get('count', 5)
    is_notes = bool(data.get('is_notes', False))

    if not is_notes and user['role'] not in ('teacher', 'admin'):
        return jsonify({'error': 'Forbidden: Only faculty administrators can generate curriculum flashcards by topic.'}), 403

    if not topic:
        return jsonify({'error': 'A subject topic or study content is required.'}), 400

    try:
        count = max(1, min(int(count), 20))
    except (TypeError, ValueError):
        return jsonify({'error': 'Question count must be an integer between 1 and 20.'}), 400

    if not os.environ.get('GEMINI_API_KEY'):
        cards = generate_fallback_cards(topic, level, count, is_notes)
        return jsonify({'cards': cards, 'fallback': True})

    if is_notes:
        prompt = (
            f'Based on the following study material, create exactly {count} useful academic flashcards '
            f'that cover the key concepts, terms, and explanations. Do not assume outside info if not present in the study notes. '
            f'Study Material:\n"""\n{topic}\n"""\n\n'
            f'Return only valid JSON in this format: '
            '{"cards":[{"question":"...","answer":"..."}]}. '
            'Do not include Markdown code fences or extra text.'
        )
    else:
        prompt = (
            f'Create exactly {count} high-quality academic flashcards about "{topic}" at the '
            f'{level} level. Return only valid JSON in this format: '
            '{"cards":[{"question":"...","answer":"..."}]}. '
            'Do not include Markdown code fences or extra text.'
        )

    clean_text, err = call_gemini_api(prompt, response_mime_type="application/json")
    if not err and clean_text:
        try:
            generated_data = json.loads(clean_text)
            if isinstance(generated_data, list):
                raw_cards = generated_data
            else:
                raw_cards = generated_data.get('cards', [])
            cards = [
                {'question': str(card.get('question', '')).strip(), 'answer': str(card.get('answer', '')).strip()}
                for card in raw_cards
                if card.get('question') and card.get('answer')
            ][:count]

            if cards:
                return jsonify({'cards': cards, 'fallback': False})
        except Exception as exc:
            print(f'Gemini JSON parsing error: {exc}')

    cards = generate_fallback_cards(topic, level, count, is_notes)
    return jsonify({'cards': cards, 'fallback': True})

