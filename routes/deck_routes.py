from flask import Blueprint, request, jsonify, session
from services.deck_service import db_create_deck, db_update_deck, db_delete_deck
from services.state_service import get_state_json

from database.connection import get_db_connection

deck_bp = Blueprint('deck_bp', __name__)

@deck_bp.route('/api/decks', methods=['POST'])
def create_deck():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    data = request.json or {}
    title = data.get('title', '').strip()
    subject = data.get('subject', '').strip()
    cards = data.get('cards', [])
    classroom_id = data.get('classroom_id')

    if classroom_id:
        conn = get_db_connection()
        user_row = conn.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()
        if not user_row or user_row['role'] != 'teacher':
            return jsonify({'error': 'Forbidden: Only teachers can assign decks to classrooms.'}), 403

    if not title or not subject:
        return jsonify({'error': 'Deck title and subject are required.'}), 400

    deck_id, error = db_create_deck(user_id, title, subject, cards, classroom_id)
    if error:
        return jsonify({'error': error}), 400

    return jsonify(get_state_json(user_id))

@deck_bp.route('/api/decks/<deck_id>', methods=['PUT'])
def update_deck(deck_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    conn = get_db_connection()
    user_row = conn.execute("SELECT name, role FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user_row:
        conn.close()
        return jsonify({'error': 'User not found'}), 404

    deck_row = conn.execute("SELECT creator_name, classroom_id FROM decks WHERE id = ?", (deck_id,)).fetchone()
    if not deck_row:
        conn.close()
        return jsonify({'error': 'Deck not found'}), 404

    if user_row['role'] == 'student':
        if deck_row['classroom_id'] is not None or deck_row['creator_name'] != user_row['name']:
            conn.close()
            return jsonify({'error': 'Forbidden: Students can only edit or delete their own custom decks.'}), 403

    data = request.json or {}
    title = data.get('title', '').strip()
    subject = data.get('subject', '').strip()
    cards = data.get('cards', [])

    if not title or not subject:
        conn.close()
        return jsonify({'error': 'Title and subject are required.'}), 400

    db_update_deck(deck_id, title, subject, cards)
    conn.close()
    return jsonify(get_state_json(user_id))

@deck_bp.route('/api/decks/<deck_id>', methods=['DELETE'])
def delete_deck(deck_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    conn = get_db_connection()
    user_row = conn.execute("SELECT name, role FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user_row:
        conn.close()
        return jsonify({'error': 'User not found'}), 404

    deck_row = conn.execute("SELECT creator_name, classroom_id FROM decks WHERE id = ?", (deck_id,)).fetchone()
    if not deck_row:
        conn.close()
        return jsonify({'error': 'Deck not found'}), 404

    if user_row['role'] == 'student':
        if deck_row['classroom_id'] is not None or deck_row['creator_name'] != user_row['name']:
            conn.close()
            return jsonify({'error': 'Forbidden: Students can only edit or delete their own custom decks.'}), 403

    success = db_delete_deck(deck_id)
    conn.close()
    if not success:
        return jsonify({'error': 'Deck not found.'}), 404

    return jsonify(get_state_json(user_id))
