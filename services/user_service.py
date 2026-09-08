import re
import uuid
import hashlib
import secrets
import os
import smtplib
from email.message import EmailMessage
from datetime import datetime, timedelta
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
        if not password:
            return 'Password is required.'
        if len(password) < 6:
            return 'Password must be at least 6 characters long.'
        if not any(c.isalpha() for c in password):
            return 'Password must contain at least one letter.'
        if not any(c.isdigit() for c in password):
            return 'Password must contain at least one number.'
        if not any(not c.isalnum() and not c.isspace() for c in password):
            return 'Password must contain at least one symbol.'
    elif password:
        if len(password) < 6:
            return 'New password must be at least 6 characters long.'
        if not any(c.isalpha() for c in password):
            return 'New password must contain at least one letter.'
        if not any(c.isdigit() for c in password):
            return 'New password must contain at least one number.'
        if not any(not c.isalnum() and not c.isspace() for c in password):
            return 'New password must contain at least one symbol.'

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
        "INSERT INTO users (id, name, email, password, role, email_verified_at) VALUES (?, ?, ?, ?, ?, NULL)",
        (user_id, name, email, hashed_pwd, role)
    )
    conn.commit()
    conn.close()
    return user_id, None

def create_auth_token(user_id, token_type, hours_valid=24):
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
    expires_at = datetime.utcnow() + timedelta(hours=hours_valid)
    conn = get_db_connection()
    conn.execute(
        "INSERT INTO auth_tokens (token_hash, user_id, token_type, expires_at) VALUES (?, ?, ?, ?)",
        (token_hash, user_id, token_type, expires_at.isoformat())
    )
    conn.commit()
    conn.close()
    return raw_token

def send_auth_email(recipient, subject, link, action_text):
    host = os.environ.get('SMTP_HOST')
    port = int(os.environ.get('SMTP_PORT', '587'))
    username = os.environ.get('SMTP_USERNAME')
    password = os.environ.get('SMTP_PASSWORD')
    sender = os.environ.get('SMTP_FROM', username)
    if not host or not username or not password or not sender:
        return False
    message = EmailMessage()
    message['Subject'] = subject
    message['From'] = sender
    message['To'] = recipient
    message.set_content(f'{action_text}\n\n{link}\n\nThis link expires automatically. If you did not request it, you can ignore this email.')
    try:
        with smtplib.SMTP(host, port, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(username, password)
            smtp.send_message(message)
        return True
    except (OSError, smtplib.SMTPException):
        return False

def consume_auth_token(raw_token, token_type):
    token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
    conn = get_db_connection()
    row = conn.execute('''
        SELECT user_id FROM auth_tokens
        WHERE token_hash = ? AND token_type = ? AND used_at IS NULL AND expires_at > ?
    ''', (token_hash, token_type, datetime.utcnow().isoformat())).fetchone()
    if not row:
        conn.close()
        return None
    conn.execute("UPDATE auth_tokens SET used_at = ? WHERE token_hash = ?", (datetime.utcnow().isoformat(), token_hash))
    if token_type == 'email_verification':
        conn.execute("UPDATE users SET email_verified_at = ? WHERE id = ?", (datetime.utcnow().isoformat(), row['user_id']))
    conn.commit()
    conn.close()
    return row['user_id']

def db_set_password_from_reset(user_id, password):
    validation_error = validate_user_input('Valid User', 'user@example.com', password, is_registration=True)
    if validation_error:
        return False, validation_error
    conn = get_db_connection()
    conn.execute("UPDATE users SET password = ? WHERE id = ?", (generate_password_hash(password), user_id))
    conn.commit()
    conn.close()
    return True, None

def db_find_or_create_google_user(google_sub, email, name):
    email = email.strip().lower()
    conn = get_db_connection()
    row = conn.execute("SELECT id FROM users WHERE google_sub = ? OR email = ?", (google_sub, email)).fetchone()
    if row:
        conn.execute("UPDATE users SET google_sub = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?", (google_sub, datetime.utcnow().isoformat(), row['id']))
        conn.commit()
        conn.close()
        return row['id'], None
    user_id = f"usr-{int(uuid.uuid4().time_low)}"
    conn.execute(
        "INSERT INTO users (id, name, email, password, role, google_sub, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (user_id, name.strip()[:80] or 'Google User', email, generate_password_hash(secrets.token_urlsafe(32)), 'student', google_sub, datetime.utcnow().isoformat())
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

def db_change_password(user_id, password):
    validation_error = validate_user_input('Valid User', 'user@example.com', password, is_registration=True)
    if validation_error:
        return False, validation_error
    conn = get_db_connection()
    conn.execute("UPDATE users SET password = ? WHERE id = ?", (generate_password_hash(password), user_id))
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
