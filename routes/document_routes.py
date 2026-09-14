"""
Document routes blueprint for RAG (Retrieval-Augmented Generation) document management,
vector chunk retrieval, and grounded Q&A.
Endpoints:
- POST /api/documents/upload-rag: Ingests PDF, indexes page chunks into vector store, extracts grounded flashcards.
- GET  /api/documents: Lists accessible indexed documents for teacher or student.
- GET  /api/documents/<doc_id>: Gets document metadata and chunk index.
- POST /api/documents/<doc_id>/query: Grounded semantic Q&A ("Ask Document") with page citations.
"""

from flask import Blueprint, request, jsonify, session
from database.connection import get_db_connection
from utils.file_validator import validate_uploaded_file
from services.rag_service import (
    index_pdf_document,
    extract_rag_flashcards,
    answer_document_query,
    retrieve_relevant_chunks
)

document_bp = Blueprint('document_bp', __name__)

def verify_document_access(document_id, user_id):
    """
    Verifies if a user has permission to view or query a document.
    Admins: Full access.
    Teachers: Access to their own documents or classrooms they manage.
    Students: Access to documents linked to classrooms they are enrolled in.
    """
    conn = get_db_connection()
    user = conn.execute("SELECT id, role FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        conn.close()
        return None, "User not found.", 401

    doc = conn.execute("SELECT * FROM course_documents WHERE id = ?", (document_id,)).fetchone()
    if not doc:
        conn.close()
        return None, "Document not found.", 404

    # Admin access
    if user['role'] == 'admin':
        conn.close()
        return dict(doc), None, 200

    # Owner access
    if doc['user_id'] == user_id:
        conn.close()
        return dict(doc), None, 200

    classroom_id = doc['classroom_id']
    if classroom_id:
        # Check if student is enrolled
        enrolled = conn.execute(
            "SELECT 1 FROM classroom_enrollments WHERE classroom_id = ? AND student_id = ?",
            (classroom_id, user_id)
        ).fetchone()
        if enrolled:
            conn.close()
            return dict(doc), None, 200

        # Check if teacher owns classroom
        teaching = conn.execute(
            "SELECT 1 FROM classrooms WHERE id = ? AND teacher_id = ?",
            (classroom_id, user_id)
        ).fetchone()
        if teaching:
            conn.close()
            return dict(doc), None, 200

    conn.close()
    return None, "Access denied: You do not have permission to access this document.", 403


@document_bp.route('/api/documents/upload-rag', methods=['POST'])
def upload_rag_document():
    """
    Ingests and indexes a PDF document using RAG pipeline:
    Extracts text per page, chunks semantically, stores unit vectors in SQLite,
    and returns grounded flashcard recommendations with source citations.
    """
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'error': 'Authentication required. Please sign in.'}), 401

    conn = get_db_connection()
    user = conn.execute("SELECT role, teacher_status FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()

    if not user:
        return jsonify({'success': False, 'error': 'User not found.'}), 401

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
    is_valid, val_err = validate_uploaded_file(file, allowed_extensions={'pdf'})
    if not is_valid:
        return jsonify({'success': False, 'error': val_err}), 400

    classroom_id = request.form.get('classroom_id') or None
    count_str = request.form.get('count', '6')
    try:
        count = max(1, min(20, int(count_str)))
    except (ValueError, TypeError):
        count = 6
    level = request.form.get('level', 'Intermediate Mastery')

    doc_info, index_err = index_pdf_document(file, file.filename, user_id, classroom_id=classroom_id)
    if index_err:
        return jsonify({'success': False, 'error': index_err}), 400

    # Extract grounded flashcards with citations from indexed chunks
    cards = extract_rag_flashcards(doc_info['document_id'], count=count, level=level)

    return jsonify({
        'success': True,
        'data': {
            'document': doc_info,
            'title': doc_info['title'],
            'cards': cards,
            'extracted_chars': doc_info.get('extracted_chars', 0)
        }
    }), 200


@document_bp.route('/api/documents', methods=['GET'])
def list_documents():
    """Lists indexed course documents accessible to the current user."""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'error': 'Authentication required.'}), 401

    conn = get_db_connection()
    user = conn.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        conn.close()
        return jsonify({'success': False, 'error': 'User not found.'}), 401

    if user['role'] == 'admin':
        rows = conn.execute("""
            SELECT d.*, u.name as uploader_name, c.name as classroom_name
            FROM course_documents d
            LEFT JOIN users u ON d.user_id = u.id
            LEFT JOIN classrooms c ON d.classroom_id = c.id
            ORDER BY d.created_at DESC
        """).fetchall()
    elif user['role'] == 'teacher':
        rows = conn.execute("""
            SELECT d.*, u.name as uploader_name, c.name as classroom_name
            FROM course_documents d
            LEFT JOIN users u ON d.user_id = u.id
            LEFT JOIN classrooms c ON d.classroom_id = c.id
            WHERE d.user_id = ? OR d.classroom_id IN (SELECT id FROM classrooms WHERE teacher_id = ?)
            ORDER BY d.created_at DESC
        """, (user_id, user_id)).fetchall()
    else:
        # Student: Documents belonging to enrolled classrooms
        rows = conn.execute("""
            SELECT d.*, u.name as uploader_name, c.name as classroom_name
            FROM course_documents d
            LEFT JOIN users u ON d.user_id = u.id
            LEFT JOIN classrooms c ON d.classroom_id = c.id
            WHERE d.classroom_id IN (SELECT classroom_id FROM classroom_enrollments WHERE student_id = ?)
            ORDER BY d.created_at DESC
        """, (user_id,)).fetchall()

    conn.close()
    docs = [dict(r) for r in rows]
    return jsonify({'success': True, 'data': {'documents': docs}}), 200


@document_bp.route('/api/documents/<document_id>', methods=['GET'])
def get_document(document_id):
    """Retrieves document overview and chunk index."""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'error': 'Authentication required.'}), 401

    doc, err, status = verify_document_access(document_id, user_id)
    if err:
        return jsonify({'success': False, 'error': err}), status

    conn = get_db_connection()
    chunks = conn.execute("""
        SELECT id, chunk_index, page_number, content, metadata_json
        FROM document_chunks
        WHERE document_id = ?
        ORDER BY chunk_index ASC
    """, (document_id,)).fetchall()
    conn.close()

    chunk_list = []
    for ch in chunks:
        chunk_list.append({
            'id': ch['id'],
            'chunk_index': ch['chunk_index'],
            'page_number': ch['page_number'],
            'snippet': ch['content'][:200] + ('...' if len(ch['content']) > 200 else '')
        })

    return jsonify({
        'success': True,
        'data': {
            'document': doc,
            'chunks': chunk_list
        }
    }), 200


@document_bp.route('/api/documents/<document_id>/query', methods=['POST'])
def query_document(document_id):
    """
    RAG Grounded Q&A ("Ask Document"):
    Searches document chunks for semantic similarity to the query and returns
    a synthesized answer with page citations.
    """
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'error': 'Authentication required.'}), 401

    doc, err, status = verify_document_access(document_id, user_id)
    if err:
        return jsonify({'success': False, 'error': err}), status

    data = request.get_json(silent=True) or {}
    query_text = data.get('query') or data.get('question') or ''

    if not isinstance(query_text, str) or len(query_text.strip()) < 3:
        return jsonify({'success': False, 'error': 'Query must be at least 3 characters.'}), 400

    result = answer_document_query(document_id, query_text.strip())
    return jsonify({
        'success': True,
        'data': result
    }), 200
