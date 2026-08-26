import uuid
from database.connection import get_db_connection

def db_register_user(name, email, password):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, password FROM users WHERE email = ?", (email,))
    existing = cursor.fetchone()
    
    if existing:
        if existing['password'] == password:
            cursor.execute("UPDATE users SET name = ? WHERE id = ?", (name, existing['id']))
            conn.commit()
            user_id = existing['id']
            conn.close()
            return user_id, None
        else:
            conn.close()
            return None, 'Email is already registered with a different password.'

    # Determine role (Only revathi@gmail.com can be teacher)
    is_teacher_admin = (email == 'revathi@gmail.com')
    role = 'teacher' if is_teacher_admin else 'student'
    user_id = f"usr-{int(uuid.uuid4().time_low)}"

    cursor.execute(
        "INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)",
        (user_id, name, email, password, role)
    )
    conn.commit()
    conn.close()
    return user_id, None

def db_login_user(email, password):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, password FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    conn.close()

    if not user or user['password'] != password:
        return None
    return user['id']

def db_update_profile(user_id, name, email, password):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check duplicate email
    cursor.execute("SELECT id FROM users WHERE email = ? AND id != ?", (email, user_id))
    if cursor.fetchone():
        conn.close()
        return False, 'Email is already taken by another user.'

    if password:
        cursor.execute("UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?", (name, email, password, user_id))
    else:
        cursor.execute("UPDATE users SET name = ?, email = ? WHERE id = ?", (name, email, user_id))
        
    conn.commit()
    conn.close()
    return True, None

def db_update_theme(user_id, theme):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET theme = ? WHERE id = ?", (theme, user_id))
    conn.commit()
    conn.close()
