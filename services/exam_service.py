"""
Timed Exam Preparation Mode Service
Handles exam topic discovery, question generation with dynamic distractors,
instant grading, Mistake Book synchronization, badge unlocking (>= 80%),
and persistent exam history tracking.
"""

import json
import uuid
import random
from datetime import datetime
from database.connection import get_db_connection
from services.quiz_service import _generate_distractors, _assemble_unique_options

def get_student_exam_topics(user_id):
    """
    Returns distinct subjects, classrooms, and decks accessible to the student,
    along with total flashcard counts for topic selection.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Decks from classrooms student is enrolled in
    cursor.execute('''
        SELECT DISTINCT d.id, d.title, d.subject, COUNT(c.id) as card_count
        FROM classroom_enrollments ce
        JOIN decks d ON ce.classroom_id = d.classroom_id
        LEFT JOIN cards c ON d.id = c.deck_id
        WHERE ce.student_id = ?
        GROUP BY d.id, d.title, d.subject
        HAVING card_count > 0
    ''', (user_id,))
    enrolled_decks = cursor.fetchall()

    # 2. Student's own custom decks
    cursor.execute('''
        SELECT DISTINCT d.id, d.title, d.subject, COUNT(c.id) as card_count
        FROM decks d
        LEFT JOIN cards c ON d.id = c.deck_id
        WHERE d.creator_id = ? AND d.classroom_id IS NULL
        GROUP BY d.id, d.title, d.subject
        HAVING card_count > 0
    ''', (user_id,))
    custom_decks = cursor.fetchall()

    # 3. If student has no enrolled/custom decks with cards, provide public/faculty decks
    all_candidate_decks = list(enrolled_decks) + list(custom_decks)
    if not all_candidate_decks:
        cursor.execute('''
            SELECT DISTINCT d.id, d.title, d.subject, COUNT(c.id) as card_count
            FROM decks d
            LEFT JOIN cards c ON d.id = c.deck_id
            GROUP BY d.id, d.title, d.subject
            HAVING card_count > 0
        ''')
        all_candidate_decks = cursor.fetchall()

    conn.close()

    # Aggregate by Subject
    subject_map = {}
    total_cards_available = 0

    for d in all_candidate_decks:
        subj = (d['subject'] or 'General Curriculum').strip()
        count = d['card_count'] or 0
        total_cards_available += count
        if subj not in subject_map:
            subject_map[subj] = {
                'subject': subj,
                'cardCount': 0,
                'deckTitles': []
            }
        subject_map[subj]['cardCount'] += count
        if d['title'] not in subject_map[subj]['deckTitles']:
            subject_map[subj]['deckTitles'].append(d['title'])

    topics_list = [
        {
            'id': 'all',
            'name': 'All Topics (Comprehensive)',
            'cardCount': total_cards_available,
            'isAll': True
        }
    ]

    for subj, data in sorted(subject_map.items(), key=lambda x: x[0].lower()):
        topics_list.append({
            'id': subj,
            'name': subj,
            'cardCount': data['cardCount'],
            'deckTitles': data['deckTitles'],
            'isAll': False
        })

    return {
        'totalAvailableCards': total_cards_available,
        'topics': topics_list
    }


def generate_timed_exam(user_id, target_topics=None, question_count=10, timer_minutes=5, difficulty='Standard Academic Curriculum'):
    """
    Generates a timed examination session with dynamic multiple-choice questions
    and believable distractors.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        q_count = int(question_count)
    except (ValueError, TypeError):
        q_count = 10
    q_count = max(3, min(q_count, 50))

    try:
        t_minutes = int(timer_minutes)
    except (ValueError, TypeError):
        t_minutes = 5
    t_minutes = max(1, min(t_minutes, 60))

    # Fetch pool of cards accessible to student
    cursor.execute('''
        SELECT c.id, c.question, c.answer, d.id as deck_id, d.title as deck_title, d.subject
        FROM cards c
        JOIN decks d ON c.deck_id = d.id
        WHERE d.classroom_id IN (
            SELECT classroom_id FROM classroom_enrollments WHERE student_id = ?
        ) OR d.creator_id = ?
    ''', (user_id, user_id))
    accessible_cards = [dict(r) for r in cursor.fetchall()]

    # Fallback to all cards if student is not yet enrolled or created decks
    if not accessible_cards:
        cursor.execute('''
            SELECT c.id, c.question, c.answer, d.id as deck_id, d.title as deck_title, d.subject
            FROM cards c
            JOIN decks d ON c.deck_id = d.id
        ''')
        accessible_cards = [dict(r) for r in cursor.fetchall()]

    # Filter by target topics if specified and not 'all'
    if target_topics and not (isinstance(target_topics, list) and ('all' in target_topics or len(target_topics) == 0)):
        topics_lower = [str(t).strip().lower() for t in target_topics if str(t).strip()]
        filtered = [
            c for c in accessible_cards 
            if (c['subject'] and c['subject'].strip().lower() in topics_lower) or 
               (c['deck_title'] and c['deck_title'].strip().lower() in topics_lower)
        ]
        if filtered:
            cards_pool = filtered
        else:
            cards_pool = accessible_cards
    else:
        cards_pool = accessible_cards

    if not cards_pool:
        conn.close()
        return None, "No flashcards found in curriculum to create an exam.", 400

    # Build global answer pool for plausible distractor fallback
    all_answers_pool = [c['answer'] for c in accessible_cards]

    # Randomly sample cards up to question_count
    random.shuffle(cards_pool)
    selected_cards = cards_pool[:q_count]

    # If cards count is less than requested, sample with replacement or take what's available
    exam_questions = []
    for idx, card in enumerate(selected_cards):
        q_text = card['question']
        correct_ans = card['answer']

        # Synthesize distractors
        distractors, explanation = _generate_distractors(q_text, correct_ans, all_answers_pool)
        options = _assemble_unique_options(correct_ans, distractors, all_answers_pool, fallback_prefix=q_text[:20])

        # Randomize options order
        random.shuffle(options)

        exam_questions.append({
            'question_number': idx + 1,
            'card_id': card['id'],
            'deck_id': card['deck_id'],
            'deck_title': card['deck_title'] or 'Curriculum Deck',
            'subject': card['subject'] or 'General',
            'question': q_text,
            'options': options
        })

    conn.close()

    # Determine Exam Subject / Title
    if target_topics and len(target_topics) == 1 and target_topics[0] != 'all':
        exam_subject = target_topics[0]
        exam_title = f"{exam_subject} Timed Examination"
    elif target_topics and len(target_topics) > 1 and 'all' not in target_topics:
        exam_subject = ", ".join(target_topics[:2]) + ("..." if len(target_topics) > 2 else "")
        exam_title = f"Multi-Topic Timed Exam ({len(target_topics)} Topics)"
    else:
        exam_subject = "Comprehensive Curriculum"
        exam_title = "Standard Timed Exam - All Topics"

    exam_session = {
        'session_id': f"exam-ses-{uuid.uuid4().hex[:12]}",
        'exam_title': exam_title,
        'subject': exam_subject,
        'timer_minutes': t_minutes,
        'timer_duration_seconds': t_minutes * 60,
        'difficulty': difficulty or 'Standard Academic Curriculum',
        'total_questions': len(exam_questions),
        'questions': exam_questions
    }

    return exam_session, None, 200


def submit_timed_exam(user_id, submission_data):
    """
    Evaluates student's submitted answers:
    - Calculates score, accuracy, time used
    - Checks 80%+ badge unlock eligibility
    - Automatically syncs missed questions to student_mistakes ('needs_review')
    - Records entry into exam_history table
    - Returns rich diagnostic analytics
    """
    answers = submission_data.get('answers', [])
    exam_title = submission_data.get('exam_title', 'Timed Examination')
    subject = submission_data.get('subject', 'Comprehensive Curriculum')
    difficulty = submission_data.get('difficulty', 'Standard Academic Curriculum')
    timer_duration_seconds = int(submission_data.get('timer_duration_seconds', 300))
    time_used_seconds = int(submission_data.get('time_used_seconds', timer_duration_seconds))

    conn = get_db_connection()
    cursor = conn.cursor()

    score = 0
    total_questions = len(answers)
    breakdown = []
    mistakes_logged_count = 0

    for item in answers:
        card_id = item.get('card_id')
        selected_option = item.get('selected_option', '').strip()
        question_text = item.get('question', '')

        # Fetch true card data
        cursor.execute('''
            SELECT c.id, c.deck_id, c.question, c.answer, d.title as deck_title, d.subject, d.classroom_id
            FROM cards c
            LEFT JOIN decks d ON c.deck_id = d.id
            WHERE c.id = ?
        ''', (card_id,))
        card_row = cursor.fetchone()

        if not card_row:
            continue

        real_answer = card_row['answer'].strip()
        real_question = card_row['question'].strip()
        deck_id = card_row['deck_id']
        deck_title = card_row['deck_title'] or 'Curriculum Deck'
        card_subject = card_row['subject'] or subject
        classroom_id = card_row['classroom_id']

        is_correct = (selected_option.lower() == real_answer.lower())

        if is_correct:
            score += 1
            result_str = 'known'
        else:
            result_str = 'review'
            mistakes_logged_count += 1
            # Mistake Book Sync: Record into student_mistakes
            mistake_id = f"mst-{user_id}-{card_id}"
            cursor.execute('''
                INSERT INTO student_mistakes (
                    id, user_id, card_id, deck_id, deck_title, subject, question, answer, source, missed_count, status, last_missed_at, resolved_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, 'exam', 1, 'needs_review', CURRENT_TIMESTAMP, NULL
                )
                ON CONFLICT(user_id, card_id) DO UPDATE SET
                    missed_count = student_mistakes.missed_count + 1,
                    status = 'needs_review',
                    resolved_at = NULL,
                    last_missed_at = CURRENT_TIMESTAMP,
                    source = 'exam',
                    deck_title = COALESCE(excluded.deck_title, student_mistakes.deck_title),
                    subject = COALESCE(excluded.subject, student_mistakes.subject)
            ''', (mistake_id, user_id, card_id, deck_id, deck_title, card_subject, real_question, real_answer))

        # Record card attempt for analytics
        cursor.execute('''
            INSERT INTO card_attempts (user_id, card_id, classroom_id, result)
            VALUES (?, ?, ?, ?)
        ''', (user_id, card_id, classroom_id, result_str))

        # Update student_progress table
        progress_id = f"prog-{user_id}-{card_id}"
        cursor.execute('''
            INSERT INTO student_progress (id, student_id, flashcard_id, classroom_id, correct_count, incorrect_count, attempts, last_reviewed)
            VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(student_id, flashcard_id) DO UPDATE SET
                correct_count = student_progress.correct_count + ?,
                incorrect_count = student_progress.incorrect_count + ?,
                attempts = student_progress.attempts + 1,
                last_reviewed = CURRENT_TIMESTAMP
        ''', (
            progress_id, user_id, card_id, classroom_id,
            1 if is_correct else 0,
            0 if is_correct else 1,
            1 if is_correct else 0,
            0 if is_correct else 1
        ))

        explanation = f"Concept verification: The accurate academic concept is '{real_answer}'."
        breakdown.append({
            'card_id': card_id,
            'question': real_question or question_text,
            'selected_option': selected_option or '(Skipped / Unanswered)',
            'correct_answer': real_answer,
            'is_correct': is_correct,
            'subject': card_subject,
            'explanation': explanation
        })

    accuracy = round((score / total_questions) * 100) if total_questions > 0 else 0
    badge_unlocked = (accuracy >= 80)

    # Save to exam_history
    exam_record_id = f"exam-{uuid.uuid4().hex[:12]}"
    cursor.execute('''
        INSERT INTO exam_history (
            id, user_id, exam_title, subject, score, total_questions, accuracy,
            time_used_seconds, time_allocated_seconds, difficulty, badge_unlocked,
            details_json, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ''', (
        exam_record_id,
        user_id,
        exam_title,
        subject,
        score,
        total_questions,
        accuracy,
        time_used_seconds,
        timer_duration_seconds,
        difficulty,
        1 if badge_unlocked else 0,
        json.dumps(breakdown)
    ))

    conn.commit()

    # Get updated unresolved mistakes count
    cursor.execute('''
        SELECT COUNT(*) FROM student_mistakes 
        WHERE user_id = ? AND status = 'needs_review'
    ''', (user_id,))
    unresolved_count = cursor.fetchone()[0] or 0

    conn.close()

    return {
        'exam_id': exam_record_id,
        'exam_title': exam_title,
        'subject': subject,
        'score': score,
        'total_questions': total_questions,
        'accuracy': accuracy,
        'badge_unlocked': badge_unlocked,
        'time_used_seconds': time_used_seconds,
        'time_allocated_seconds': timer_duration_seconds,
        'difficulty': difficulty,
        'mistakes_logged_count': mistakes_logged_count,
        'unresolved_mistakes_count': unresolved_count,
        'breakdown': breakdown,
        'completed_at': datetime.now().strftime('%b %d, %Y, %I:%M %p')
    }, None, 200


def get_exam_history(user_id):
    """
    Returns student's past exam preparation attempts ordered by completed_at DESC.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT id, exam_title, subject, score, total_questions, accuracy,
               time_used_seconds, time_allocated_seconds, difficulty, badge_unlocked,
               completed_at
        FROM exam_history
        WHERE user_id = ?
        ORDER BY completed_at DESC
    ''', (user_id,))
    rows = cursor.fetchall()
    conn.close()

    history = []
    for r in rows:
        time_used_sec = r['time_used_seconds'] or 0
        minutes = time_used_sec // 60
        seconds = time_used_sec % 60
        time_str = f"{minutes:02d}:{seconds:02d}"

        # Format date
        raw_date = r['completed_at']
        try:
            dt = datetime.strptime(str(raw_date)[:19], '%Y-%m-%d %H:%M:%S')
            formatted_date = dt.strftime('%b %d, %Y, %I:%M %p')
        except Exception:
            formatted_date = str(raw_date)

        history.append({
            'id': r['id'],
            'examTitle': r['exam_title'],
            'subject': r['subject'],
            'score': f"{r['score']} / {r['total_questions']}",
            'rawScore': r['score'],
            'totalQuestions': r['total_questions'],
            'accuracy': r['accuracy'],
            'badgeUnlocked': bool(r['badge_unlocked']),
            'timeUsed': time_str,
            'timeUsedSeconds': time_used_sec,
            'difficulty': r['difficulty'],
            'dateCompleted': formatted_date
        })

    return history


def get_exam_details_by_id(user_id, exam_id):
    """
    Fetches full diagnostic analytics breakdown for a single past exam attempt.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT id, exam_title, subject, score, total_questions, accuracy,
               time_used_seconds, time_allocated_seconds, difficulty, badge_unlocked,
               details_json, completed_at
        FROM exam_history
        WHERE id = ? AND user_id = ?
    ''', (exam_id, user_id))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None, "Exam attempt not found.", 404

    breakdown = []
    if row['details_json']:
        try:
            breakdown = json.loads(row['details_json'])
        except Exception:
            breakdown = []

    time_used_sec = row['time_used_seconds'] or 0
    minutes = time_used_sec // 60
    seconds = time_used_sec % 60
    time_str = f"{minutes:02d}:{seconds:02d}"

    raw_date = row['completed_at']
    try:
        dt = datetime.strptime(str(raw_date)[:19], '%Y-%m-%d %H:%M:%S')
        formatted_date = dt.strftime('%b %d, %Y, %I:%M %p')
    except Exception:
        formatted_date = str(raw_date)

    return {
        'id': row['id'],
        'examTitle': row['exam_title'],
        'subject': row['subject'],
        'score': row['score'],
        'totalQuestions': row['total_questions'],
        'accuracy': row['accuracy'],
        'badgeUnlocked': bool(row['badge_unlocked']),
        'timeUsed': time_str,
        'timeUsedSeconds': time_used_sec,
        'timeAllocatedSeconds': row['time_allocated_seconds'],
        'difficulty': row['difficulty'],
        'dateCompleted': formatted_date,
        'breakdown': breakdown
    }, None, 200
