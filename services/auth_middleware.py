from functools import wraps
from flask import session, jsonify
from database.connection import get_db_connection

def require_role(*allowed_roles):
    """
    Decorator enforcing role-based access control.
    Returns:
      - 401 Unauthorized if user is not authenticated.
      - 403 Forbidden if user is authenticated but lacks any of allowed_roles.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_id = session.get('user_id')
            if not user_id:
                return jsonify({'error': 'Authentication required. Please sign in.'}), 401

            conn = get_db_connection()
            user = conn.execute(
                "SELECT id, name, email, role, teacher_status FROM users WHERE id = ?",
                (user_id,)
            ).fetchone()
            conn.close()

            if not user:
                return jsonify({'error': 'User account not found.'}), 401

            if user['role'] not in allowed_roles:
                return jsonify({'error': 'Forbidden: Insufficient permissions.'}), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator

def get_current_user():
    """Returns database record of the currently authenticated user, or None."""
    user_id = session.get('user_id')
    if not user_id:
        return None
    conn = get_db_connection()
    user = conn.execute(
        "SELECT id, name, email, role, teacher_status FROM users WHERE id = ?",
        (user_id,)
    ).fetchone()
    conn.close()
    return user
