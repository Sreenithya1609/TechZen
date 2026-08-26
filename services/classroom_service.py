import uuid
import random
import string
from database.connection import get_db_connection

def db_create_classroom(user_id, name, subject):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verify user is teacher
    cursor.execute("SELECT name, role FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user or user['role'] != 'teacher':
        conn.close()
        return None, 'Only faculty admins can create classrooms.'

    # Generate unique code
    prefix = ''.join(c for c in subject if c.isalnum()).upper()[:4]
    if len(prefix) < 3:
        prefix = "CLS"
    
    code = f"{prefix}{''.join(random.choices(string.ascii_uppercase + string.digits, k=4))}"
    classroom_id = f"cls-{int(uuid.uuid4().time_low)}"

    cursor.execute(
        "INSERT INTO classrooms (id, name, subject, code, teacher_name, avg_performance, enrolled_count) VALUES (?, ?, ?, ?, ?, 80, 0)",
        (classroom_id, name, subject, code, user['name'])
    )
    conn.commit()
    conn.close()
    return classroom_id, None

def db_join_classroom(user_id, code):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Find classroom
    cursor.execute("SELECT id, name, enrolled_count FROM classrooms WHERE UPPER(code) = ?", (code,))
    classroom = cursor.fetchone()
    if not classroom:
        conn.close()
        return None, 'Invalid classroom code.'

    # Check if enrolled
    cursor.execute("SELECT 1 FROM classroom_enrollments WHERE classroom_id = ? AND student_id = ?", (classroom['id'], user_id))
    if cursor.fetchone():
        conn.close()
        return None, 'Already joined this classroom.'

    # Enroll student
    cursor.execute(
        "INSERT INTO classroom_enrollments (classroom_id, student_id, mark, completed_decks) VALUES (?, ?, 85, 0)",
        (classroom['id'], user_id)
    )
    # Increment count
    cursor.execute("UPDATE classrooms SET enrolled_count = enrolled_count + 1 WHERE id = ?", (classroom['id'],))
    
    conn.commit()
    conn.close()
    return classroom['id'], None
