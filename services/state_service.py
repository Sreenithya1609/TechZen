import json
from database.connection import get_db_connection
from services.streak_service import calculate_streak

def get_state_json(user_id=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Current User & Theme
    current_user = None
    theme = 'light'
    if user_id:
        cursor.execute("SELECT id, name, email, role, theme FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if row:
            current_user = {
                'id': row['id'],
                'name': row['name'],
                'email': row['email'],
                'role': row['role']
            }
            theme = row['theme'] if row['theme'] in ('light', 'dark') else 'light'

    # 2. Classrooms
    cursor.execute("SELECT id, name, subject, code, teacher_name, avg_performance, enrolled_count FROM classrooms ORDER BY name ASC")
    classrooms_rows = cursor.fetchall()
    classrooms = []
    for c_row in classrooms_rows:
        cls_id = c_row['id']
        
        # Enrolled Students
        cursor.execute('''
            SELECT u.id, u.name, u.email, ce.mark, ce.completed_decks
            FROM classroom_enrollments ce
            JOIN users u ON ce.student_id = u.id
            WHERE ce.classroom_id = ?
            ORDER BY u.name ASC
        ''', (cls_id,))
        enrolled_students = [
            {
                'id': r['id'],
                'name': r['name'],
                'email': r['email'],
                'mark': r['mark'],
                'completedDecks': r['completed_decks']
            } for r in cursor.fetchall()
        ]
        
        # Filter enrolled students for security: students only see themselves
        if current_user and current_user['role'] == 'student':
            enrolled_students = [s for s in enrolled_students if s['id'] == user_id]
        
        # Deck IDs
        cursor.execute("SELECT id FROM decks WHERE classroom_id = ?", (cls_id,))
        classroom_deck_ids = [r['id'] for r in cursor.fetchall()]
        
        classrooms.append({
            'id': cls_id,
            'name': c_row['name'],
            'subject': c_row['subject'],
            'code': c_row['code'],
            'teacher': c_row['teacher_name'],
            'enrolledCount': c_row['enrolled_count'],
            'avgPerformance': c_row['avg_performance'],
            'enrolledStudents': enrolled_students,
            'decks': classroom_deck_ids
        })

    # 3. Decks (classroom decks or custom decks by user)
    if user_id:
        cursor.execute("SELECT name FROM users WHERE id = ?", (user_id,))
        user_name_row = cursor.fetchone()
        user_name = user_name_row['name'] if user_name_row else ""
        cursor.execute('''
            SELECT id, title, subject, creator_name, classroom_id 
            FROM decks 
            WHERE classroom_id IS NOT NULL OR creator_name = ?
            ORDER BY id ASC
        ''', (user_name,))
    else:
        cursor.execute('SELECT id, title, subject, creator_name, classroom_id FROM decks WHERE classroom_id IS NOT NULL ORDER BY id ASC')
    
    decks_rows = cursor.fetchall()
    decks = []
    for d_row in decks_rows:
        deck_id = d_row['id']
        cursor.execute("SELECT question, answer FROM cards WHERE deck_id = ? ORDER BY id ASC", (deck_id,))
        cards = [{'question': r['question'], 'answer': r['answer']} for r in cursor.fetchall()]
        decks.append({
            'id': deck_id,
            'title': d_row['title'],
            'subject': d_row['subject'],
            'cards': cards,
            'creator': d_row['creator_name'],
            'classroom_id': d_row['classroom_id']
        })

    # 4. Student Progress
    cursor.execute('''
        SELECT u.id, u.name, u.email, c.name as course, ce.completed_decks, ce.mark
        FROM classroom_enrollments ce
        JOIN users u ON ce.student_id = u.id
        JOIN classrooms c ON ce.classroom_id = c.id
        ORDER BY u.name ASC
    ''')
    student_progress = [
        {
            'id': r['id'],
            'name': r['name'],
            'email': r['email'],
            'course': r['course'],
            'completedDecks': r['completed_decks'],
            'mark': r['mark']
        } for r in cursor.fetchall()
    ]

    # Security check: Students should ONLY see their own progress record
    if current_user and current_user['role'] == 'student':
        student_progress = [sp for sp in student_progress if sp['id'] == user_id]

    # 5. Student Joined Classrooms
    student_joined_classrooms = []
    if user_id:
        cursor.execute("SELECT classroom_id FROM classroom_enrollments WHERE student_id = ?", (user_id,))
        student_joined_classrooms = [r['classroom_id'] for r in cursor.fetchall()]

    # 6. Daily Streak
    daily_streak = None
    if user_id:
        # Calculate streak from study_activity table dynamically
        streak_count = calculate_streak(user_id, conn)

        cursor.execute('''
            SELECT last_played_date, secret_word, clues, current_clue_index, solved
            FROM daily_streaks
            WHERE user_id = ?
        ''', (user_id,))
        streak_row = cursor.fetchone()
        if streak_row:
            daily_streak = {
                'count': streak_count,
                'lastPlayedDate': streak_row['last_played_date'],
                'secretWord': streak_row['secret_word'],
                'clues': json.loads(streak_row['clues']),
                'currentClueIndex': streak_row['current_clue_index'],
                'solved': bool(streak_row['solved'])
            }
        else:
            # Create a default streak card
            default_clues = [
                'Discovered mathematically by Sir Isaac Newton in 1687.',
                'An invisible fundamental force that pulls physical objects toward one another.',
                'Governs celestial orbits, planetary paths, and tides across the galaxy.',
                'Exerts a natural acceleration equal to 9.8 m/s² on Earth\'s surface.'
            ]
            cursor.execute('''
                INSERT INTO daily_streaks (user_id, count, last_played_date, secret_word, clues, current_clue_index, solved)
                VALUES (?, ?, NULL, 'GRAVITY', ?, 0, 0)
            ''', (user_id, streak_count, json.dumps(default_clues)))
            conn.commit()
            daily_streak = {
                'count': streak_count,
                'lastPlayedDate': None,
                'secretWord': 'GRAVITY',
                'clues': default_clues,
                'currentClueIndex': 0,
                'solved': False
            }

    conn.close()
    
    return {
        'currentUser': current_user,
        'theme': theme,
        'classrooms': classrooms,
        'decks': decks,
        'studentProgress': student_progress,
        'studentJoinedClassrooms': student_joined_classrooms,
        'dailyStreak': daily_streak
    }
