import json
from database.connection import get_db_connection

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create tables
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        theme TEXT DEFAULT 'light'
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS classrooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        teacher_name TEXT NOT NULL,
        avg_performance INTEGER DEFAULT 80,
        enrolled_count INTEGER DEFAULT 0
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS classroom_enrollments (
        classroom_id TEXT,
        student_id TEXT,
        mark INTEGER DEFAULT 85,
        completed_decks INTEGER DEFAULT 4,
        PRIMARY KEY (classroom_id, student_id),
        FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS decks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        subject TEXT NOT NULL,
        creator_name TEXT NOT NULL,
        classroom_id TEXT,
        FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        deck_id TEXT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS daily_streaks (
        user_id TEXT PRIMARY KEY,
        count INTEGER DEFAULT 0,
        last_played_date TEXT,
        secret_word TEXT DEFAULT 'GRAVITY',
        clues TEXT NOT NULL, -- JSON array
        current_clue_index INTEGER DEFAULT 0,
        solved BOOLEAN DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    ''')

    # Create study_activity table for daily dynamic study checks
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS study_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        study_date TEXT NOT NULL,
        UNIQUE (user_id, study_date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    ''')

    conn.commit()

    # Seed Default Data if empty
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        print("Seeding database with default values...")
        
        # 1. Users (Only revathi@gmail.com is TEACHER. All others are STUDENT)
        users = [
            ('usr-teacher-1', 'Revathi', 'revathi@gmail.com', '123', 'teacher'),
            ('usr-student-1', 'Eleanor Vance', 'student@gmail.com', '123', 'student'),
            ('st-2', 'Marcus Aurelius', 'marcus@university.edu', '123', 'student'),
            ('st-3', 'Sophia Lin', 'sophia@university.edu', '123', 'student'),
            ('st-4', 'Julian Thorne', 'julian@university.edu', '123', 'student'),
            ('st-5', 'Clara Oswald', 'clara@university.edu', '123', 'student'),
        ]
        cursor.executemany("INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)", users)

        # 2. Classrooms (Seeded with Revathi as instructor)
        classrooms = [
            ('cls-1', 'Biology 101: Cellular Mechanics', 'Biology', 'BIO101X', 'Revathi', 82, 3),
            ('cls-2', 'Java Programming & Data Structures', 'Computer Science', 'JAVA92A', 'Revathi', 76, 3),
            ('cls-3', 'Cloud Computing & Distributed Systems', 'Technology', 'CLOUD7B', 'Revathi', 74, 2),
        ]
        cursor.executemany("INSERT INTO classrooms (id, name, subject, code, teacher_name, avg_performance, enrolled_count) VALUES (?, ?, ?, ?, ?, ?, ?)", classrooms)

        # 3. Classroom Enrollments
        enrollments = [
            ('cls-1', 'usr-student-1', 96, 4),
            ('cls-1', 'st-3', 92, 5),
            ('cls-1', 'st-2', 85, 3),
            ('cls-2', 'usr-student-1', 88, 3),
            ('cls-2', 'st-5', 92, 4),
            ('cls-2', 'st-4', 82, 2),
            ('cls-3', 'st-5', 94, 4),
            ('cls-3', 'st-2', 90, 3),
        ]
        cursor.executemany("INSERT INTO classroom_enrollments (classroom_id, student_id, mark, completed_decks) VALUES (?, ?, ?, ?)", enrollments)

        # 4. Decks
        decks = [
            ('deck-1', 'Cellular Respiration & Mitosis', 'Biology', 'Revathi', 'cls-1'),
            ('deck-2', 'Java OOP Concepts & Collections', 'Computer Science', 'Revathi', 'cls-2'),
            ('deck-3', 'Cloud Architecture & AWS Services', 'Technology', 'Revathi', 'cls-3'),
        ]
        cursor.executemany("INSERT INTO decks (id, title, subject, creator_name, classroom_id) VALUES (?, ?, ?, ?, ?)", decks)

        # 5. Cards
        cards = [
            # Deck 1
            ('card-1-1', 'deck-1', 'What is the primary energy currency produced by mitochondria?', 'ATP (Adenosine Triphosphate)'),
            ('card-1-2', 'deck-1', 'What phase of cell division comes immediately after Metaphase?', 'Anaphase'),
            ('card-1-3', 'deck-1', 'What key molecule accepts final electrons during aerobic respiration?', 'Oxygen (O₂)'),
            ('card-1-4', 'deck-1', 'Define Mitosis in simple biological terms.', 'The process where a single cell divides into two identical daughter cells.'),
            # Deck 2
            ('card-2-1', 'deck-2', 'What are the four fundamental pillars of Object-Oriented Programming (OOP) in Java?', 'Encapsulation, Inheritance, Polymorphism, and Abstraction.'),
            ('card-2-2', 'deck-2', 'What is the difference between == and .equals() in Java?', '== compares memory address references; .equals() compares logical values.'),
            ('card-2-3', 'deck-2', 'What is the difference between ArrayList and LinkedList in Java?', 'ArrayList is backed by a dynamic array offering O(1) index access; LinkedList is a doubly-linked list.'),
            # Deck 3
            ('card-3-1', 'deck-3', 'What is the primary purpose of Amazon S3?', 'Scalable object storage in the cloud.'),
            ('card-3-2', 'deck-3', 'Define IaaS vs PaaS in cloud computing.', 'IaaS provides raw virtual infrastructure; PaaS provides a platform for app development without managing servers.'),
        ]
        cursor.executemany("INSERT INTO cards (id, deck_id, question, answer) VALUES (?, ?, ?, ?)", cards)

        # 6. Daily Streaks
        clues = [
            'Discovered mathematically by Sir Isaac Newton in 1687.',
            'An invisible fundamental force that pulls physical objects toward one another.',
            'Governs celestial orbits, planetary paths, and tides across the galaxy.',
            'Exerts a natural acceleration equal to 9.8 m/s² on Earth\'s surface.'
        ]
        cursor.execute(
            "INSERT INTO daily_streaks (user_id, count, last_played_date, secret_word, clues, current_clue_index, solved) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ('usr-student-1', 5, None, 'GRAVITY', json.dumps(clues), 0, 0)
        )

        conn.commit()

    # Dynamic Roles Migration & Integrity Checks (enforce only revathi@gmail.com is TEACHER)
    cursor.execute("UPDATE users SET role = 'student' WHERE email != 'revathi@gmail.com' AND role = 'teacher'")
    cursor.execute("UPDATE users SET role = 'teacher' WHERE email = 'revathi@gmail.com' AND role = 'student'")
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print("Database initialization complete.")
