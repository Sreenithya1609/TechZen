"""
Timed Exam Preparation Mode Routes Blueprint
Exposes endpoints for topic selection, timed MCQ exam generation,
submission with instant diagnostics, and exam history retrieval.
"""

from flask import Blueprint, jsonify, request, session
from services.exam_service import (
    get_student_exam_topics,
    generate_timed_exam,
    submit_timed_exam,
    get_exam_history,
    get_exam_details_by_id
)

exam_bp = Blueprint('exam_bp', __name__)

@exam_bp.route('/api/exam/topics', methods=['GET'])
def get_exam_topics():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Authentication required. Please sign in.'}), 401

    data = get_student_exam_topics(user_id)
    return jsonify({
        'success': True,
        'data': data
    }), 200


@exam_bp.route('/api/exam/generate', methods=['POST'])
def generate_exam():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Authentication required. Please sign in.'}), 401

    payload = request.get_json(silent=True) or {}
    target_topics = payload.get('topics', ['all'])
    question_count = payload.get('question_count', 10)
    timer_minutes = payload.get('timer_minutes', 5)
    difficulty = payload.get('difficulty', 'Standard Academic Curriculum')

    exam_session, err_msg, status_code = generate_timed_exam(
        user_id=user_id,
        target_topics=target_topics,
        question_count=question_count,
        timer_minutes=timer_minutes,
        difficulty=difficulty
    )

    if err_msg:
        return jsonify({'error': err_msg}), status_code

    return jsonify({
        'success': True,
        'data': exam_session
    }), 200


@exam_bp.route('/api/exam/submit', methods=['POST'])
def submit_exam():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Authentication required. Please sign in.'}), 401

    payload = request.get_json(silent=True) or {}
    answers = payload.get('answers', [])
    if not answers:
        return jsonify({'error': 'No examination answers submitted.'}), 400

    results, err_msg, status_code = submit_timed_exam(user_id, payload)
    if err_msg:
        return jsonify({'error': err_msg}), status_code

    return jsonify({
        'success': True,
        'data': results
    }), 200


@exam_bp.route('/api/exam/history', methods=['GET'])
def get_history():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Authentication required. Please sign in.'}), 401

    history = get_exam_history(user_id)
    return jsonify({
        'success': True,
        'history': history
    }), 200


@exam_bp.route('/api/exam/history/<exam_id>', methods=['GET'])
def get_single_exam_details(exam_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Authentication required. Please sign in.'}), 401

    details, err_msg, status_code = get_exam_details_by_id(user_id, exam_id)
    if err_msg:
        return jsonify({'error': err_msg}), status_code

    return jsonify({
        'success': True,
        'data': details
    }), 200
