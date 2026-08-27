import json
from datetime import datetime, timedelta
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
            SELECT u.id, u.name, u.email, ce.completed_decks
            FROM classroom_enrollments ce
            JOIN users u ON ce.student_id = u.id
            WHERE ce.classroom_id = ?
            ORDER BY u.name ASC
        ''', (cls_id,))
        enrolled_students = []
        for r in cursor.fetchall():
            stu_id = r['id']
            # Calculate student's dynamic mark in this classroom
            cursor.execute('''
                SELECT COUNT(*) FROM card_attempts 
                WHERE user_id = ? AND classroom_id = ? AND result = 'known'
            ''', (stu_id, cls_id))
            stu_known = cursor.fetchone()[0] or 0
            
            cursor.execute('''
                SELECT COUNT(*) FROM card_attempts 
                WHERE user_id = ? AND classroom_id = ?
            ''', (stu_id, cls_id))
            stu_total = cursor.fetchone()[0] or 0
            
            stu_mark = round((stu_known / stu_total) * 100) if stu_total > 0 else 0
            
            enrolled_students.append({
                'id': r['id'],
                'name': r['name'],
                'email': r['email'],
                'mark': stu_mark,
                'completedDecks': r['completed_decks']
            })

        # Calculate real-time average performance (Class Mastery) from card attempts
        cursor.execute('''
            SELECT COUNT(*) FROM card_attempts 
            WHERE classroom_id = ? AND result = 'known'
        ''', (cls_id,))
        class_known = cursor.fetchone()[0] or 0
        
        cursor.execute('''
            SELECT COUNT(*) FROM card_attempts 
            WHERE classroom_id = ?
        ''', (cls_id,))
        class_total = cursor.fetchone()[0] or 0
        
        avg_perf = round((class_known / class_total) * 100) if class_total > 0 else 0

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
            'avgPerformance': avg_perf,
            'enrolledStudents': enrolled_students,
            'decks': classroom_deck_ids
        })

    # 3. Decks (classroom decks or custom decks by user)
    if user_id:
        cursor.execute("SELECT name, role FROM users WHERE id = ?", (user_id,))
        user_row = cursor.fetchone()
        user_name = user_row['name'] if user_row else ""
        user_role = user_row['role'] if user_row else "student"
        
        if user_role == 'teacher':
            cursor.execute('''
                SELECT id, title, subject, creator_name, classroom_id 
                FROM decks 
                WHERE classroom_id IS NOT NULL OR creator_name = ?
                ORDER BY id ASC
            ''', (user_name,))
        else:
            cursor.execute('''
                SELECT id, title, subject, creator_name, classroom_id 
                FROM decks 
                WHERE classroom_id IN (SELECT classroom_id FROM classroom_enrollments WHERE student_id = ?)
                   OR (classroom_id IS NULL AND creator_name = ?)
                ORDER BY id ASC
            ''', (user_id, user_name))
    else:
        cursor.execute('SELECT id, title, subject, creator_name, classroom_id FROM decks WHERE classroom_id IS NOT NULL ORDER BY id ASC')
    
    decks_rows = cursor.fetchall()
    decks = []
    for d_row in decks_rows:
        deck_id = d_row['id']
        cursor.execute("SELECT id, question, answer FROM cards WHERE deck_id = ? ORDER BY id ASC", (deck_id,))
        cards = [{'id': r['id'], 'question': r['question'], 'answer': r['answer']} for r in cursor.fetchall()]
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

        CONCEPTS_POOL = [
            {
                'secret_word': 'GRAVITY',
                'clues': [
                    'Discovered mathematically by Sir Isaac Newton in 1687.',
                    'An invisible fundamental force that pulls physical objects toward one another.',
                    'Governs celestial orbits, planetary paths, and tides across the galaxy.',
                    'Exerts a natural acceleration equal to 9.8 m/s² on Earth\'s surface.'
                ]
            },
            {
                'secret_word': 'PHOTOSYNTHESIS',
                'clues': [
                    'Mainly takes place in the chloroplasts of eukaryotic cells.',
                    'Converts light energy, carbon dioxide, and water into chemical energy.',
                    'Produces oxygen as a byproduct of splitting water molecules.',
                    'The primary process by which plants and autotrophs generate glucose.'
                ]
            },
            {
                'secret_word': 'MITOSIS',
                'clues': [
                    'Part of the cell cycle where replicated chromosomes are separated.',
                    'Includes phases: Prophase, Metaphase, Anaphase, and Telophase.',
                    'Results in two genetically identical diploid daughter cells.',
                    'Responsible for growth and tissue repair in multicellular organisms.'
                ]
            },
            {
                'secret_word': 'ALGORITHM',
                'clues': [
                    'A finite sequence of rigorous instructions to solve a class of problems.',
                    'Analyzed using Big O notation to evaluate time and space complexity.',
                    'Can be expressed in pseudocode, flowcharts, or programming languages.',
                    'Famous examples include Dijkstra, binary search, and bubble sort.'
                ]
            },
            {
                'secret_word': 'DATABASE',
                'clues': [
                    'An organized collection of data stored and accessed electronically.',
                    'Often managed using software systems abbreviated as DBMS.',
                    'Employs structures like tables, indexes, schemas, and relationships.',
                    'Usually queried using languages like SQL or structured NoSQL objects.'
                ]
            },
            {
                'secret_word': 'RECURSION',
                'clues': [
                    'A method of solving problems where a function calls itself.',
                    'Requires a base case to terminate execution and prevent stack overflow.',
                    'Commonly used in tree traversals and depth-first search algorithms.',
                    'A classic example is calculating factorials or Fibonacci numbers.'
                ]
            },
            {
                'secret_word': 'COMPILER',
                'clues': [
                    'A program that translates source code into machine-executable binary.',
                    'Performs phases like lexical analysis, parsing, and code generation.',
                    'Produces syntax error listings if the source code violates language rules.',
                    'Translates languages like C++ or Java into machine code or bytecode.'
                ]
            },
            {
                'secret_word': 'DNA',
                'clues': [
                    'A double-helix molecule containing genetic instructions for development.',
                    'Composed of four nitrogenous bases: Adenine, Thymine, Guanine, and Cytosine.',
                    'Discovered structurally by Watson, Crick, and Rosalind Franklin.',
                    'Stands for Deoxyribonucleic Acid.'
                ]
            },
            {
                'secret_word': 'INTERNET',
                'clues': [
                    'A global system of interconnected computer networks using TCP/IP.',
                    'Originated from ARPANET, a project funded by the US Department of Defense.',
                    'Forms the foundational infrastructure that hosts the World Web.',
                    'Connects billions of personal, academic, and business devices worldwide.'
                ]
            },
            {
                'secret_word': 'OSI MODEL',
                'clues': [
                    'A conceptual framework characterising network communications.',
                    'Standardized by the ISO in 1984 as a standard reference reference design.',
                    'Includes Application, Presentation, Session, and Transport layers.',
                    'Composed of exactly seven distinct hierarchical layers.'
                ]
            }
        ]

        cursor.execute('''
            SELECT last_played_date, secret_word, clues, current_clue_index, solved
            FROM daily_streaks
            WHERE user_id = ?
        ''', (user_id,))
        streak_row = cursor.fetchone()
        
        today_date = datetime.now().strftime("%Y-%m-%d")
        
        if streak_row:
            last_played = streak_row['last_played_date']
            if last_played != today_date:
                import random
                concept = random.choice(CONCEPTS_POOL)
                cursor.execute('''
                    UPDATE daily_streaks 
                    SET secret_word = ?, clues = ?, current_clue_index = 0, solved = 0, last_played_date = ?
                    WHERE user_id = ?
                ''', (concept['secret_word'], json.dumps(concept['clues']), today_date, user_id))
                conn.commit()
                
                # Refetch
                cursor.execute('''
                    SELECT last_played_date, secret_word, clues, current_clue_index, solved
                    FROM daily_streaks
                    WHERE user_id = ?
                ''', (user_id,))
                streak_row = cursor.fetchone()

            daily_streak = {
                'count': streak_count,
                'lastPlayedDate': streak_row['last_played_date'],
                'secretWord': streak_row['secret_word'],
                'clues': json.loads(streak_row['clues']),
                'currentClueIndex': streak_row['current_clue_index'],
                'solved': bool(streak_row['solved'])
            }
        else:
            import random
            concept = random.choice(CONCEPTS_POOL)
            cursor.execute('''
                INSERT INTO daily_streaks (user_id, count, last_played_date, secret_word, clues, current_clue_index, solved)
                VALUES (?, ?, ?, ?, ?, 0, 0)
            ''', (user_id, streak_count, today_date, concept['secret_word'], json.dumps(concept['clues'])))
            conn.commit()
            daily_streak = {
                'count': streak_count,
                'lastPlayedDate': today_date,
                'secretWord': concept['secret_word'],
                'clues': concept['clues'],
                'currentClueIndex': 0,
                'solved': False
            }

    # 7. Daily Activity Logs (last 30 days)
    daily_activity = []
    for i in range(29, -1, -1):
        dt = datetime.now() - timedelta(days=i)
        day_date = dt.strftime("%Y-%m-%d")
        day_label = dt.strftime("%a")
        cursor.execute("SELECT COUNT(DISTINCT user_id) FROM study_activity WHERE study_date = ?", (day_date,))
        count = cursor.fetchone()[0] or 0
        daily_activity.append({
            'date': day_date,
            'label': day_label,
            'count': count
        })

    cards_studied_today = 0
    if user_id:
        from datetime import timezone
        today_local = datetime.now().strftime("%Y-%m-%d")
        today_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        cursor.execute('''
            SELECT COUNT(*) FROM card_attempts 
            WHERE user_id = ? AND (created_at LIKE ? OR created_at LIKE ?)
        ''', (user_id, f"{today_local}%", f"{today_utc}%"))
        cards_studied_today = cursor.fetchone()[0] or 0

    conn.close()
    
    return {
        'currentUser': current_user,
        'theme': theme,
        'classrooms': classrooms,
        'decks': decks,
        'studentProgress': student_progress,
        'studentJoinedClassrooms': student_joined_classrooms,
        'dailyStreak': daily_streak,
        'dailyActivity': daily_activity,
        'cardsStudiedToday': cards_studied_today
    }
