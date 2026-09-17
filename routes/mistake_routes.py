from datetime import datetime
from flask import Blueprint, jsonify, request, session
from database.connection import get_db_connection

mistake_bp = Blueprint('mistake_bp', __name__)

@mistake_bp.route('/api/mistakes', methods=['GET'])
def get_student_mistakes():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    status_filter = request.args.get('status', 'needs_review')
    topic_filter = request.args.get('topic', 'all')
    search_query = request.args.get('search', '').strip().lower()

    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Calculate overall counts for this student
    cursor.execute('''
        SELECT 
            COUNT(*) as total_all,
            SUM(CASE WHEN status = 'needs_review' THEN 1 ELSE 0 END) as total_needs_review,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as total_resolved
        FROM student_mistakes
        WHERE user_id = ?
    ''', (user_id,))
    counts_row = cursor.fetchone()
    total_all = counts_row['total_all'] or 0
    total_needs_review = counts_row['total_needs_review'] or 0
    total_resolved = counts_row['total_resolved'] or 0

    # 2. Get distinct topics/subjects for dropdown
    cursor.execute('''
        SELECT DISTINCT subject 
        FROM student_mistakes 
        WHERE user_id = ? AND subject IS NOT NULL AND subject != ''
        ORDER BY subject ASC
    ''', (user_id,))
    topics = [r['subject'] for r in cursor.fetchall()]

    # Also collect distinct deck titles as topics if needed
    cursor.execute('''
        SELECT DISTINCT deck_title 
        FROM student_mistakes 
        WHERE user_id = ? AND deck_title IS NOT NULL AND deck_title != ''
        ORDER BY deck_title ASC
    ''', (user_id,))
    deck_titles = [r['deck_title'] for r in cursor.fetchall()]

    # 3. Query filtered mistakes
    query = '''
        SELECT id, card_id, deck_id, deck_title, subject, question, answer, source,
               missed_count, status, last_missed_at, resolved_at
        FROM student_mistakes
        WHERE user_id = ?
    '''
    params = [user_id]

    if status_filter in ('needs_review', 'resolved'):
        query += ' AND status = ?'
        params.append(status_filter)

    if topic_filter and topic_filter != 'all':
        query += ' AND (LOWER(subject) = LOWER(?) OR LOWER(deck_title) = LOWER(?))'
        params.extend([topic_filter, topic_filter])

    if search_query:
        query += ' AND (LOWER(question) LIKE ? OR LOWER(answer) LIKE ? OR LOWER(deck_title) LIKE ? OR LOWER(subject) LIKE ?)'
        wildcard = f'%{search_query}%'
        params.extend([wildcard, wildcard, wildcard, wildcard])

    query += ' ORDER BY CASE WHEN status = "needs_review" THEN 0 ELSE 1 END, last_missed_at DESC'

    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    conn.close()

    mistakes = [
        {
            'id': r['id'],
            'cardId': r['card_id'],
            'deckId': r['deck_id'],
            'deckTitle': r['deck_title'] or 'Academic Deck',
            'subject': r['subject'] or 'General',
            'question': r['question'],
            'answer': r['answer'],
            'source': r['source'] or 'practice',
            'missedCount': r['missed_count'] or 1,
            'status': r['status'] or 'needs_review',
            'lastMissedAt': r['last_missed_at'],
            'resolvedAt': r['resolved_at']
        }
        for r in rows
    ]

    return jsonify({
        'success': True,
        'mistakes': mistakes,
        'counts': {
            'all': total_all,
            'needs_review': total_needs_review,
            'resolved': total_resolved
        },
        'topics': topics,
        'deckTitles': deck_titles
    })

@mistake_bp.route('/api/mistakes/resolve', methods=['POST'])
def resolve_mistake():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    data = request.get_json(silent=True) or {}
    mistake_id = data.get('mistake_id')
    card_id = data.get('card_id')
    new_status = data.get('status', 'resolved')

    if new_status not in ('resolved', 'needs_review'):
        return jsonify({'error': 'Invalid status. Must be "resolved" or "needs_review".'}), 400

    if not mistake_id and not card_id:
        return jsonify({'error': 'Either mistake_id or card_id is required.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    if mistake_id:
        cursor.execute('''
            UPDATE student_mistakes 
            SET status = ?, 
                resolved_at = CASE WHEN ? = 'resolved' THEN CURRENT_TIMESTAMP ELSE NULL END
            WHERE id = ? AND user_id = ?
        ''', (new_status, new_status, mistake_id, user_id))
    else:
        cursor.execute('''
            UPDATE student_mistakes 
            SET status = ?, 
                resolved_at = CASE WHEN ? = 'resolved' THEN CURRENT_TIMESTAMP ELSE NULL END
            WHERE card_id = ? AND user_id = ?
        ''', (new_status, new_status, card_id, user_id))

    conn.commit()

    # Recalculate remaining count
    cursor.execute('''
        SELECT 
            COUNT(*) as total_all,
            SUM(CASE WHEN status = 'needs_review' THEN 1 ELSE 0 END) as total_needs_review,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as total_resolved
        FROM student_mistakes
        WHERE user_id = ?
    ''', (user_id,))
    counts_row = cursor.fetchone()
    conn.close()

    return jsonify({
        'success': True,
        'status': new_status,
        'counts': {
            'all': counts_row['total_all'] or 0,
            'needs_review': counts_row['total_needs_review'] or 0,
            'resolved': counts_row['total_resolved'] or 0
        }
    })

@mistake_bp.route('/api/mistakes/record', methods=['POST'])
def record_mistake():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    data = request.get_json(silent=True) or {}
    card_id = data.get('card_id')
    source = data.get('source', 'practice')

    if not card_id:
        return jsonify({'error': 'card_id is required.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Look up card & deck info
    cursor.execute('''
        SELECT c.id, c.deck_id, c.question, c.answer, d.title as deck_title, d.subject
        FROM cards c
        LEFT JOIN decks d ON c.deck_id = d.id
        WHERE c.id = ?
    ''', (card_id,))
    card = cursor.fetchone()

    if not card:
        conn.close()
        return jsonify({'error': 'Card not found.'}), 404

    mistake_id = f"mst-{user_id}-{card_id}"
    deck_title = card['deck_title'] or 'Academic Deck'
    subject = card['subject'] or 'General'

    cursor.execute('''
        INSERT INTO student_mistakes (
            id, user_id, card_id, deck_id, deck_title, subject, question, answer, source, missed_count, status, last_missed_at, resolved_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'needs_review', CURRENT_TIMESTAMP, NULL
        )
        ON CONFLICT(user_id, card_id) DO UPDATE SET
            missed_count = student_mistakes.missed_count + 1,
            status = 'needs_review',
            resolved_at = NULL,
            last_missed_at = CURRENT_TIMESTAMP,
            deck_title = COALESCE(excluded.deck_title, student_mistakes.deck_title),
            subject = COALESCE(excluded.subject, student_mistakes.subject)
    ''', (mistake_id, user_id, card_id, card['deck_id'], deck_title, subject, card['question'], card['answer'], source))

    conn.commit()

    cursor.execute('''
        SELECT COUNT(*) FROM student_mistakes 
        WHERE user_id = ? AND status = 'needs_review'
    ''', (user_id,))
    needs_review_count = cursor.fetchone()[0] or 0
    conn.close()

    return jsonify({
        'success': True,
        'mistake_id': mistake_id,
        'needs_review_count': needs_review_count
    })

@mistake_bp.route('/api/mistakes/review-deck', methods=['GET'])
def get_mistakes_review_deck():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT card_id, question, answer, deck_title, subject
        FROM student_mistakes
        WHERE user_id = ? AND status = 'needs_review'
        ORDER BY missed_count DESC, last_missed_at DESC
    ''', (user_id,))
    rows = cursor.fetchall()
    conn.close()

    cards = [
        {
            'id': r['card_id'],
            'question': r['question'],
            'answer': r['answer']
        }
        for r in rows
    ]

    return jsonify({
        'success': True,
        'deck': {
            'id': 'deck-mistakes-remediation',
            'title': 'Targeted Mistake Remediation',
            'subject': 'Mistake Book',
            'creator': 'Mistake Book AI Remediation',
            'cards': cards
        },
        'count': len(cards)
    })
