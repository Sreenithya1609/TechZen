"""
Upload routes blueprint for faculty document ingestion.
Endpoint: POST /api/decks/upload
Allows approved teachers and administrators to upload PDF and TXT documents,
extracting academic text and generating flashcard previews for approval.
"""

from flask import Blueprint, request, jsonify, session
from database.connection import get_db_connection
from utils.file_validator import validate_uploaded_file
from services.document_service import extract_text_from_file
from services.flashcard_service import generate_flashcards_from_text

upload_bp = Blueprint('upload_bp', __name__)

@upload_bp.route('/api/decks/upload', methods=['POST'])
def upload_course_document():
    """
    Handles PDF and TXT file uploads by approved faculty.
    Extracts content, synthesizes flashcard questions, and returns preview.
    """
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({
            'success': False,
            'error': 'Authentication required. Please sign in.'
        }), 401

    conn = get_db_connection()
    user = conn.execute("SELECT role, teacher_status FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()

    if not user:
        return jsonify({'success': False, 'error': 'User not found.'}), 401

    # Only approved teachers and administrators may upload documents
    if user['role'] == 'student':
        return jsonify({
            'success': False,
            'error': 'Forbidden: Students are not permitted to upload course documents.'
        }), 403

    if user['role'] == 'teacher' and user['teacher_status'] != 'approved':
        return jsonify({
            'success': False,
            'error': 'Forbidden: Only approved faculty can upload course documents.'
        }), 403

    file = request.files.get('file')
    is_valid, val_err = validate_uploaded_file(file)
    if not is_valid:
        return jsonify({'success': False, 'error': val_err}), 400

    extracted_text, extract_err = extract_text_from_file(file, file.filename)
    if extract_err:
        return jsonify({'success': False, 'error': extract_err}), 400

    count = request.form.get('count', 6)
    level = request.form.get('level', 'Intermediate Mastery')

    cards = generate_flashcards_from_text(extracted_text, count=count, level=level)

    # Derive human-friendly title from filename
    raw_name = file.filename.rsplit('.', 1)[0]
    cleaned_title = raw_name.replace('_', ' ').replace('-', ' ').strip().title()

    return jsonify({
        'success': True,
        'data': {
            'title': cleaned_title or 'Course Study Material',
            'cards': cards,
            'extracted_chars': len(extracted_text)
        }
    }), 200
