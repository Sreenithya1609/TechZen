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

def db_register_user(name, email, password, role='student'):
    if not isinstance(name, str):
        return None, 'Name must be a string'
    if not isinstance(email, str):
        return None, 'Email must be a string'
    if not isinstance(password, str):
        return None, 'Password must be a string'
    if role is not None and not isinstance(role, str):
        return None, 'Role must be a string'

    name = name.strip()
    email = email.strip().lower()
    role = (role or 'student').strip().lower()
    
    validation_error = validate_user_input(name, email, password, is_registration=True)
    if validation_error:
        return None, validation_error

    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
    existing = cursor.fetchone()
    
    if existing:
        conn.close()
        return None, 'An account with this email already exists.'

    # If teacher is requested, user active role is student with pending approval for admin
    if role == 'teacher':
        assigned_role = 'student'
        teacher_status = 'pending'
    else:
        assigned_role = 'student'
        teacher_status = 'none'

    user_id = f"usr-{int(uuid.uuid4().time_low)}"
    hashed_pwd = generate_password_hash(password)
    now_iso = datetime.utcnow().isoformat()

    cursor.execute(
        "INSERT INTO users (id, name, email, password, role, teacher_status, email_verified_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (user_id, name, email, hashed_pwd, assigned_role, teacher_status, now_iso, now_iso)
    )

    if teacher_status == 'pending':
        app_id = f"app-{int(uuid.uuid4().time_low)}"
        cursor.execute(
            "INSERT INTO teacher_applications (id, user_id, status, submitted_at) VALUES (?, ?, 'pending', ?)",
            (app_id, user_id, now_iso)
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

def db_google_auth(email, name=None, picture=None, google_id=None):
    if not email:
        return None, 'Google authentication failed: Email address not provided by Google.'

    email = email.strip().lower()
    name = (name or '').strip()
    if not name:
        name = email.split('@')[0].capitalize()

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id, name, role FROM users WHERE email = ?", (email,))
    existing = cursor.fetchone()

    if existing:
        # If user exists, update name if needed and return their id
        if name and existing['name'] != name and len(name) >= 2:
            cursor.execute("UPDATE users SET name = ? WHERE id = ?", (name, existing['id']))
            conn.commit()
        user_id = existing['id']
        conn.close()
        return user_id, None

    # New user: auto-register with student role and none teacher_status
    role = 'student'
    teacher_status = 'none'
    user_id = f"usr-{int(uuid.uuid4().time_low)}"
    random_pwd = uuid.uuid4().hex + "GAuth!1"
    hashed_pwd = generate_password_hash(random_pwd)
    now_iso = datetime.utcnow().isoformat()

    cursor.execute(
        "INSERT INTO users (id, name, email, password, role, teacher_status, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (user_id, name, email, hashed_pwd, role, teacher_status, now_iso)
    )
    conn.commit()
    conn.close()
    return user_id, None

def db_request_teacher_access(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, role, teacher_status FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return None, 'User not found.'

    if user['role'] == 'teacher':
        conn.close()
        return None, 'You are already a registered teacher.'
    if user['role'] == 'admin':
        conn.close()
        return None, 'Administrators cannot request teacher access.'
    if user['teacher_status'] == 'pending':
        conn.close()
        return None, 'A teacher access request is already pending approval.'

    cursor.execute("UPDATE users SET teacher_status = 'pending' WHERE id = ?", (user_id,))
    now_iso = datetime.utcnow().isoformat()
    app_id = f"app-{int(uuid.uuid4().time_low)}"
    cursor.execute(
        "INSERT INTO teacher_applications (id, user_id, status, submitted_at) VALUES (?, ?, 'pending', ?)",
        (app_id, user_id, now_iso)
    )
    conn.commit()
    conn.close()
    return 'pending', None

def db_get_teacher_requests(status_filter=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
        SELECT u.id as user_id, u.name, u.email, u.role, u.teacher_status, u.created_at,
               ta.id as application_id, ta.submitted_at, ta.reviewed_at, ta.reviewed_by
        FROM users u
        LEFT JOIN teacher_applications ta ON u.id = ta.user_id
        WHERE u.teacher_status != 'none'
    """
    params = []
    if status_filter and status_filter in ('pending', 'approved', 'rejected'):
        query += " AND u.teacher_status = ?"
        params.append(status_filter)

    query += " ORDER BY COALESCE(ta.submitted_at, u.created_at) DESC"
    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        result.append({
            'id': r['user_id'],
            'userId': r['user_id'],
            'applicationId': r['application_id'] or f"app-{r['user_id']}",
            'name': r['name'],
            'email': r['email'],
            'role': r['role'],
            'teacher_status': r['teacher_status'],
            'submitted_at': r['submitted_at'] or r['created_at'],
            'reviewed_at': r['reviewed_at'],
            'reviewed_by': r['reviewed_by'],
            'created_at': r['created_at']
        })
    return result

def db_approve_teacher_request(user_id, admin_id=None):
    if admin_id and admin_id == user_id:
        return False, 'Teachers cannot approve their own application.'

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, role, teacher_status FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return False, 'Target user not found.'
    if user['teacher_status'] != 'pending':
        conn.close()
        return False, 'User does not have a pending teacher request.'

    cursor.execute("UPDATE users SET role = 'teacher', teacher_status = 'approved' WHERE id = ?", (user_id,))
    
    # Update teacher_applications table
    now_iso = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    cursor.execute("""
        UPDATE teacher_applications 
        SET status = 'approved', reviewed_at = ?, reviewed_by = ?
        WHERE user_id = ? AND status = 'pending'
    """, (now_iso, admin_id, user_id))
    if cursor.rowcount == 0:
        app_id = f"app-{int(uuid.uuid4().time_low)}"
        cursor.execute("""
            INSERT INTO teacher_applications (id, user_id, status, submitted_at, reviewed_at, reviewed_by)
            VALUES (?, ?, 'approved', ?, ?, ?)
        """, (app_id, user_id, now_iso, now_iso, admin_id))

    conn.commit()
    conn.close()
    return True, None

def db_reject_teacher_request(user_id, admin_id=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, role, teacher_status FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return False, 'Target user not found.'
    if user['teacher_status'] != 'pending':
        conn.close()
        return False, 'User does not have a pending teacher request.'

    cursor.execute("UPDATE users SET role = 'student', teacher_status = 'rejected' WHERE id = ?", (user_id,))

    # Update teacher_applications table
    now_iso = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    cursor.execute("""
        UPDATE teacher_applications 
        SET status = 'rejected', reviewed_at = ?, reviewed_by = ?
        WHERE user_id = ? AND status = 'pending'
    """, (now_iso, admin_id, user_id))
    if cursor.rowcount == 0:
        app_id = f"app-{int(uuid.uuid4().time_low)}"
        cursor.execute("""
            INSERT INTO teacher_applications (id, user_id, status, submitted_at, reviewed_at, reviewed_by)
            VALUES (?, ?, 'rejected', ?, ?, ?)
        """, (app_id, user_id, now_iso, now_iso, admin_id))

    conn.commit()
    conn.close()
    return True, None

def record_user_login(user_id, ip_address=None, user_agent=None):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, email, role FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        if not user:
            conn.close()
            return
        
        now_iso = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute(
            "INSERT INTO login_history (user_id, user_name, user_email, role, ip_address, user_agent, login_time) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user['id'], user['name'], user['email'], user['role'], ip_address or '127.0.0.1', (user_agent or '')[:150], now_iso)
        )
        try:
            cursor.execute("UPDATE users SET last_login_at = ? WHERE id = ?", (now_iso, user_id))
        except Exception:
            pass
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error recording login: {e}")

def db_get_login_history(role_filter=None, search=None, limit=100):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT id, user_id, user_name, user_email, role, ip_address, user_agent, login_time FROM login_history WHERE 1=1"
    params = []
    
    if role_filter and role_filter in ('teacher', 'student', 'admin'):
        query += " AND role = ?"
        params.append(role_filter)
        
    if search:
        query += " AND (user_name LIKE ? OR user_email LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term])
        
    query += " ORDER BY login_time DESC, id DESC LIMIT ?"
    params.append(limit)
    
    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    
    cursor.execute("SELECT COUNT(*) FROM login_history")
    total_logins = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(DISTINCT user_id) FROM login_history WHERE role = 'teacher'")
    active_teachers = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(DISTINCT user_id) FROM login_history WHERE role = 'student'")
    active_students = cursor.fetchone()[0]
    
    conn.close()
    
    logins = [
        {
            'id': r['id'],
            'userId': r['user_id'],
            'userName': r['user_name'],
            'userEmail': r['user_email'],
            'role': r['role'],
            'ipAddress': r['ip_address'] or '127.0.0.1',
            'userAgent': r['user_agent'] or 'Browser Session',
            'loginTime': r['login_time']
        }
        for r in rows
    ]
    
    return {
        'logins': logins,
        'stats': {
            'totalLogins': total_logins,
            'activeTeachers': active_teachers,
            'activeStudents': active_students
        }
    }



