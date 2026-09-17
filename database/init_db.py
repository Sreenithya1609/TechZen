import json
from datetime import datetime
from werkzeug.security import generate_password_hash
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
        role TEXT NOT NULL CHECK(role IN ('admin', 'teacher', 'student')),
        teacher_status TEXT DEFAULT 'none' CHECK(teacher_status IN ('none', 'pending', 'approved', 'rejected')),
        theme TEXT DEFAULT 'light',
        google_sub TEXT UNIQUE,
        email_verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS auth_tokens (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_type TEXT NOT NULL CHECK(token_type IN ('email_verification', 'password_reset')),
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    ''')

    # Add account fields to databases created by older versions of FlashLearn.
    existing_columns = {row['name'] for row in cursor.execute("PRAGMA table_info(users)").fetchall()}
    if 'google_sub' not in existing_columns:
        cursor.execute('ALTER TABLE users ADD COLUMN google_sub TEXT')
    if 'email_verified_at' not in existing_columns:
        cursor.execute('ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP')
    if 'teacher_status' not in existing_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN teacher_status TEXT DEFAULT 'none'")
    if 'last_login_at' not in existing_columns:
        cursor.execute('ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP')

    # Migrate users table if check constraint doesn't allow 'admin'
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
    users_sql_row = cursor.fetchone()
    users_sql = (users_sql_row['sql'] if hasattr(users_sql_row, 'keys') and 'sql' in users_sql_row.keys() else users_sql_row[0]) if users_sql_row else ''
    if users_sql and "'admin'" not in users_sql:
        cursor.execute("PRAGMA foreign_keys = OFF")
        cursor.execute('''
        CREATE TABLE users_migrated (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin', 'teacher', 'student')),
            teacher_status TEXT DEFAULT 'none' CHECK(teacher_status IN ('none', 'pending', 'approved', 'rejected')),
            theme TEXT DEFAULT 'light',
            google_sub TEXT UNIQUE,
            email_verified_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        cursor.execute('''
        INSERT INTO users_migrated (id, name, email, password, role, teacher_status, theme, google_sub, email_verified_at, created_at)
        SELECT id, name, email, password, role,
               COALESCE(teacher_status, 'none'),
               COALESCE(theme, 'light'),
               google_sub, email_verified_at, created_at
        FROM users
        ''')
        cursor.execute("DROP TABLE users")
        cursor.execute("ALTER TABLE users_migrated RENAME TO users")
        cursor.execute("PRAGMA foreign_keys = ON")

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS classrooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        teacher_name TEXT NOT NULL,
        teacher_id TEXT,
        avg_performance INTEGER DEFAULT 80,
        enrolled_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL
    )
    ''')
    existing_classroom_columns = {row['name'] for row in cursor.execute("PRAGMA table_info(classrooms)").fetchall()}
    if 'teacher_id' not in existing_classroom_columns:
        cursor.execute('ALTER TABLE classrooms ADD COLUMN teacher_id TEXT')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS classroom_enrollments (
        classroom_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        mark INTEGER DEFAULT 85,
        completed_decks INTEGER DEFAULT 4,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
        creator_id TEXT,
        classroom_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
    )
    ''')
    existing_deck_columns = {row['name'] for row in cursor.execute("PRAGMA table_info(decks)").fetchall()}
    if 'creator_id' not in existing_deck_columns:
        cursor.execute('ALTER TABLE decks ADD COLUMN creator_id TEXT')

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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, study_date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    ''')

    # Create card_attempts table for tracking real-time flashcard attempts
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS card_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        card_id TEXT NOT NULL,
        classroom_id TEXT,
        result TEXT NOT NULL CHECK(result IN ('known', 'review')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
        FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS login_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        user_name TEXT,
        user_email TEXT,
        role TEXT NOT NULL CHECK(role IN ('admin', 'teacher', 'student')),
        ip_address TEXT,
        user_agent TEXT,
        login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    ''')

    # RAG Document Management & Semantic Vector Chunks
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS course_documents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        classroom_id TEXT,
        filename TEXT NOT NULL,
        title TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        total_pages INTEGER NOT NULL,
        total_chunks INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE SET NULL
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS document_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        page_number INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding_json TEXT NOT NULL,
        metadata_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES course_documents(id) ON DELETE CASCADE
    )
    ''')

    cursor.execute('CREATE INDEX IF NOT EXISTS idx_doc_chunks_doc_id ON document_chunks(document_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_course_docs_user_id ON course_documents(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_course_docs_classroom_id ON course_documents(classroom_id)')

    # Feature 5: Student Learning Metrics & Progress Tracking
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS student_progress (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        flashcard_id TEXT NOT NULL,
        classroom_id TEXT,
        correct_count INTEGER DEFAULT 0,
        incorrect_count INTEGER DEFAULT 0,
        attempts INTEGER DEFAULT 0,
        last_reviewed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (student_id, flashcard_id),
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (flashcard_id) REFERENCES cards(id) ON DELETE CASCADE,
        FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE SET NULL
    )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_student_progress_classroom ON student_progress(classroom_id, student_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_student_progress_card ON student_progress(flashcard_id)')

    # Feature 6: Teacher Application Verification
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS teacher_applications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')),
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP,
        reviewed_by TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_teacher_apps_status ON teacher_applications(status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_teacher_apps_user ON teacher_applications(user_id)')

    # Feature 7: Student Mistake Book (Targeted Remediation)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS student_mistakes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        card_id TEXT NOT NULL,
        deck_id TEXT,
        deck_title TEXT,
        subject TEXT,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        source TEXT DEFAULT 'practice',
        missed_count INTEGER DEFAULT 1,
        status TEXT DEFAULT 'needs_review' CHECK(status IN ('needs_review', 'resolved')),
        last_missed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        UNIQUE (user_id, card_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_student_mistakes_user ON student_mistakes(user_id, status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_student_mistakes_deck ON student_mistakes(deck_id)')

    conn.commit()

    # Seed Default Data if empty
    ADMIN_EMAIL = "revathi@gmail.com"
    ADMIN_PASSWORD = "Techzen_123"
    ADMIN_ROLE = "admin"
    admin_pwd_hash = generate_password_hash(ADMIN_PASSWORD)
    student_pwd_hash = generate_password_hash('Password123!')

    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        print("Seeding database with secure enterprise default values...")

        # 1. Users (revathi@gmail.com is ADMIN. All others are STUDENT)
        users = [
            ('usr-admin-1', 'Revathi', ADMIN_EMAIL, admin_pwd_hash, ADMIN_ROLE, 'approved'),
            ('usr-student-1', 'Eleanor Vance', 'student@gmail.com', student_pwd_hash, 'student', 'none'),
            ('st-2', 'Marcus Aurelius', 'marcus@university.edu', student_pwd_hash, 'student', 'none'),
            ('st-3', 'Sophia Lin', 'sophia@university.edu', student_pwd_hash, 'student', 'none'),
            ('st-4', 'Julian Thorne', 'julian@university.edu', student_pwd_hash, 'student', 'none'),
            ('st-5', 'Clara Oswald', 'clara@university.edu', student_pwd_hash, 'student', 'none'),
        ]
        cursor.executemany(
            "INSERT INTO users (id, name, email, password, role, teacher_status, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
            users
        )

        # 2. Classrooms (Faculty classrooms available for joining via course code)
        classrooms = [
            ('cls-1', 'Biology 101: Cellular Mechanics', 'Biology', 'BIO101X', 'Revathi', 'usr-admin-1', 0, 0),
            ('cls-2', 'Java Programming & Data Structures', 'Computer Science', 'JAVA92A', 'Revathi', 'usr-admin-1', 0, 0),
            ('cls-3', 'Cloud Computing & Distributed Systems', 'Technology', 'CLOUD7B', 'Revathi', 'usr-admin-1', 0, 0),
        ]
        cursor.executemany(
            "INSERT INTO classrooms (id, name, subject, code, teacher_name, teacher_id, avg_performance, enrolled_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            classrooms
        )

        # 3. Daily Streaks (Individual student challenge)
        clues = [
            'Discovered mathematically by Sir Isaac Newton in 1687.',
            'An invisible fundamental force that pulls physical objects toward one another.',
            'Governs celestial orbits, planetary paths, and tides across the galaxy.',
            'Exerts a natural acceleration equal to 9.8 m/s² on Earth\'s surface.'
        ]
        cursor.execute(
            "INSERT INTO daily_streaks (user_id, count, last_played_date, secret_word, clues, current_clue_index, solved) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ('usr-student-1', 0, None, 'GRAVITY', json.dumps(clues), 0, 0)
        )

        conn.commit()

    # Dynamic Roles Migration & Idempotent Admin Provisioning
    # 1. Ensure revathi@gmail.com is ADMIN with Techzen_123 password and approved teacher status
    cursor.execute("SELECT id FROM users WHERE email = ?", (ADMIN_EMAIL,))
    admin_row = cursor.fetchone()
    if admin_row:
        cursor.execute(
            "UPDATE users SET role = 'admin', password = ?, teacher_status = 'approved', email_verified_at = CURRENT_TIMESTAMP WHERE id = ?",
            (admin_pwd_hash, admin_row['id'])
        )
        admin_id = admin_row['id']
    else:
        admin_id = 'usr-admin-1'
        cursor.execute(
            "INSERT INTO users (id, name, email, password, role, teacher_status, email_verified_at) VALUES (?, ?, ?, ?, 'admin', 'approved', CURRENT_TIMESTAMP)",
            (admin_id, 'Revathi', ADMIN_EMAIL, admin_pwd_hash)
        )

    # 2. Ensure other accounts have valid teacher_status and role
    cursor.execute("UPDATE users SET teacher_status = 'none' WHERE teacher_status IS NULL AND role = 'student'")
    cursor.execute("UPDATE users SET teacher_status = 'approved' WHERE teacher_status IS NULL AND role = 'teacher'")
    cursor.execute("UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE email_verified_at IS NULL")

    # 3. Seeded student passwords to Password123!
    cursor.execute(
        "UPDATE users SET password = ? WHERE email = 'student@gmail.com'",
        (student_pwd_hash,)
    )

    # 4. Link existing classrooms and decks to admin_id if teacher_id/creator_id are NULL
    cursor.execute("UPDATE classrooms SET teacher_id = ? WHERE teacher_id IS NULL", (admin_id,))
    cursor.execute("UPDATE decks SET creator_id = ? WHERE creator_id IS NULL AND classroom_id IS NOT NULL", (admin_id,))

    # 5. Seed initial login history if empty
    cursor.execute("SELECT COUNT(*) FROM login_history")
    if cursor.fetchone()[0] == 0:
        existing_users = cursor.execute("SELECT id, name, email, role FROM users LIMIT 10").fetchall()
        sample_logins = []
        for i, u in enumerate(existing_users):
            sample_logins.append((
                u['id'],
                u['name'],
                u['email'],
                u['role'],
                f'192.168.1.{15 + i}',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            ))
        if sample_logins:
            cursor.executemany(
                "INSERT INTO login_history (user_id, user_name, user_email, role, ip_address, user_agent, login_time) VALUES (?, ?, ?, ?, ?, ?, ?)",
                sample_logins
            )

    # 6. Seed student_progress from card_attempts if empty
    cursor.execute("SELECT COUNT(*) FROM student_progress")
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT OR IGNORE INTO student_progress (id, student_id, flashcard_id, classroom_id, correct_count, incorrect_count, attempts, last_reviewed)
            SELECT 
                'prog-' || user_id || '-' || card_id,
                user_id,
                card_id,
                classroom_id,
                SUM(CASE WHEN result = 'known' THEN 1 ELSE 0 END),
                SUM(CASE WHEN result = 'review' THEN 1 ELSE 0 END),
                COUNT(*),
                MAX(created_at)
            FROM card_attempts
            GROUP BY user_id, card_id
        ''')

    # 7. Seed teacher_applications from existing users with teacher_status != 'none' if empty
    cursor.execute("SELECT COUNT(*) FROM teacher_applications")
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT OR IGNORE INTO teacher_applications (id, user_id, status, submitted_at, reviewed_at, reviewed_by)
            SELECT 
                'app-' || id,
                id,
                teacher_status,
                created_at,
                CASE WHEN teacher_status IN ('approved', 'rejected') THEN created_at ELSE NULL END,
                CASE WHEN teacher_status IN ('approved', 'rejected') THEN ? ELSE NULL END
            FROM users
            WHERE teacher_status != 'none'
        ''', (admin_id,))

    # 8. Seed student_mistakes from existing card_attempts where result = 'review'
    cursor.execute("SELECT COUNT(*) FROM student_mistakes")
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT OR IGNORE INTO student_mistakes (
                id, user_id, card_id, deck_id, deck_title, subject, question, answer, source, missed_count, status, last_missed_at
            )
            SELECT 
                'mst-' || ca.user_id || '-' || ca.card_id,
                ca.user_id,
                ca.card_id,
                c.deck_id,
                COALESCE(d.title, 'Academic Flashcard Deck'),
                COALESCE(d.subject, 'General'),
                c.question,
                c.answer,
                'practice',
                COUNT(ca.id),
                'needs_review',
                MAX(ca.created_at)
            FROM card_attempts ca
            JOIN cards c ON ca.card_id = c.id
            LEFT JOIN decks d ON c.deck_id = d.id
            WHERE ca.result = 'review'
            GROUP BY ca.user_id, ca.card_id
        ''')

    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print("Database initialization complete.")
