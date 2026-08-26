import re
import uuid
from werkzeug.security import generate_password_hash, check_password_hash
from database.connection import get_db_connection

EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$')

def validate_user_input(name, email, password=None, is_registration=True):
    if not name or len(name.strip()) < 2:
        return 'Full name must be at least 2 characters long.'
    if len(name.strip()) > 80:
        return 'Full name cannot exceed 80 characters.'
        
    if not email or not EMAIL_REGEX.match(email.strip()):
        return 'Please enter a valid email address.'
    if len(email.strip()) > 120:
        return 'Email address is too long.'

    if is_registration:
        if not password or len(password) < 3:
            return 'Password must be at least 3 characters long.'
    elif password:
        if len(password) < 3:
            return 'New password must be at least 3 characters long.'

    return None

def db_register_user(name, email, password):
    name = name.strip()
    email = email.strip().lower()
    
    validation_error = validate_user_input(name, email, password, is_registration=True)
    if validation_error:
        return None, validation_error

    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, password FROM users WHERE email = ?", (email,))
    existing = cursor.fetchone()
    
    if existing:
        # Check if matching password
        stored_hash = existing['password']
        is_correct = False
        if stored_hash.startswith(('scrypt:', 'pbkdf2:')):
            is_correct = check_password_hash(stored_hash, password)
        else:
            is_correct = (stored_hash == password)
            
        if is_correct:
            # Upgrade password hash and update name
            new_hash = generate_password_hash(password)
            cursor.execute("UPDATE users SET name = ?, password = ? WHERE id = ?", (name, new_hash, existing['id']))
            conn.commit()
            user_id = existing['id']
            conn.close()
            return user_id, None
        else:
            conn.close()
            return None, 'An account with this email already exists with a different password.'

    # Determine role (Only revathi@gmail.com is teacher / Faculty Admin)
    is_teacher_admin = (email == 'revathi@gmail.com')
    role = 'teacher' if is_teacher_admin else 'student'
    user_id = f"usr-{int(uuid.uuid4().time_low)}"
    hashed_pwd = generate_password_hash(password)

    cursor.execute(
        "INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)",
        (user_id, name, email, hashed_pwd, role)
    )
    conn.commit()
    conn.close()
    return user_id, None

def db_login_user(email, password):
    if not email or not password:
        return None
        
    email = email.strip().lower()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, password FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    
    if not user:
        conn.close()
        return None

    stored_password = user['password']
    is_valid = False
    
    if stored_password.startswith(('scrypt:', 'pbkdf2:')):
        is_valid = check_password_hash(stored_password, password)
    else:
        # Backward compatibility check for legacy plaintext passwords
        if stored_password == password:
            is_valid = True
            # Transparently upgrade legacy plaintext password to secure hash
            upgraded_hash = generate_password_hash(password)
            cursor.execute("UPDATE users SET password = ? WHERE id = ?", (upgraded_hash, user['id']))
            conn.commit()

    conn.close()
    if not is_valid:
        return None
    return user['id']

def db_update_profile(user_id, name, email, password=None):
    name = name.strip()
    email = email.strip().lower()

    validation_error = validate_user_input(name, email, password, is_registration=False)
    if validation_error:
        return False, validation_error

    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check duplicate email
    cursor.execute("SELECT id FROM users WHERE email = ? AND id != ?", (email, user_id))
    if cursor.fetchone():
        conn.close()
        return False, 'This email address is already in use by another account.'

    if password and password.strip():
        hashed_pwd = generate_password_hash(password.strip())
        cursor.execute("UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?", (name, email, hashed_pwd, user_id))
    else:
        cursor.execute("UPDATE users SET name = ?, email = ? WHERE id = ?", (name, email, user_id))
        
    conn.commit()
    conn.close()
    return True, None

def db_update_theme(user_id, theme):
    if theme not in ('light', 'dark'):
        theme = 'light'
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET theme = ? WHERE id = ?", (theme, user_id))
    conn.commit()
    conn.close()
