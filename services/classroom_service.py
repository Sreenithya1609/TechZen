import re
import uuid
import random
import string
from database.connection import get_db_connection

def db_create_classroom(user_id, name, subject):
    name = name.strip()
    subject = subject.strip()

    if len(name) < 3 or len(name) > 100:
        return None, 'Course title must be between 3 and 100 characters.'
    if len(subject) < 2 or len(subject) > 60:
        return None, 'Subject tag must be between 2 and 60 characters.'

    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verify user is teacher
    cursor.execute("SELECT name, role FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user or user['role'] != 'teacher':
        conn.close()
        return None, 'Only faculty administrators can create classrooms.'

    # Generate unique alphanumeric code
    prefix = ''.join(c for c in subject if c.isalnum()).upper()[:4]
    if len(prefix) < 3:
        prefix = "CLS"
    
    code = None
    for _ in range(10):
        candidate_code = f"{prefix}{''.join(random.choices(string.ascii_uppercase + string.digits, k=4))}"
        cursor.execute("SELECT 1 FROM classrooms WHERE code = ?", (candidate_code,))
        if not cursor.fetchone():
            code = candidate_code
            break
            
    if not code:
        code = f"CLS{int(uuid.uuid4().time_low) % 1000000:06d}"

    classroom_id = f"cls-{int(uuid.uuid4().time_low)}"

    cursor.execute(
        "INSERT INTO classrooms (id, name, subject, code, teacher_name, avg_performance, enrolled_count) VALUES (?, ?, ?, ?, ?, 80, 0)",
        (classroom_id, name, subject, code, user['name'])
    )
    conn.commit()
    conn.close()
    return classroom_id, None

def db_join_classroom(user_id, code):
    code = code.strip().upper()
    if not code or not re.match(r'^[A-Z0-9]{4,12}$', code):
        return None, 'Invalid access code format. Please check the code.'

    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verify user exists
    cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return None, 'User not found.'

    # Find classroom
    cursor.execute("SELECT id, name, enrolled_count FROM classrooms WHERE UPPER(code) = ?", (code,))
    classroom = cursor.fetchone()
    if not classroom:
        conn.close()
        return None, 'No classroom found matching this access code.'

    # Check if enrolled
    cursor.execute("SELECT 1 FROM classroom_enrollments WHERE classroom_id = ? AND student_id = ?", (classroom['id'], user_id))
    if cursor.fetchone():
        conn.close()
        return None, 'You are already enrolled in this classroom.'

    # Enroll student
    cursor.execute(
        "INSERT INTO classroom_enrollments (classroom_id, student_id, mark, completed_decks) VALUES (?, ?, 85, 0)",
        (classroom['id'], user_id)
    )
    # Recalculate and update enrolled count
    cursor.execute("SELECT COUNT(*) FROM classroom_enrollments WHERE classroom_id = ?", (classroom['id'],))
    actual_count = cursor.fetchone()[0]
    cursor.execute("UPDATE classrooms SET enrolled_count = ? WHERE id = ?", (actual_count, classroom['id']))
    
    conn.commit()
    conn.close()
    return classroom['id'], None

def db_delete_classroom(user_id, classroom_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user or user['role'] != 'teacher':
        conn.close()
        return False, 'Forbidden: Only faculty administrators can delete classrooms.'
        
    cursor.execute("SELECT id FROM classrooms WHERE id = ?", (classroom_id,))
    if not cursor.fetchone():
        conn.close()
        return False, 'Classroom not found.'
        
    cursor.execute("DELETE FROM classrooms WHERE id = ?", (classroom_id,))
    conn.commit()
    conn.close()
    return True, None
