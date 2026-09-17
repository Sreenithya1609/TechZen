import os
import re
import json
from dotenv import load_dotenv
from urllib import error as urllib_error
from urllib import request as urllib_request
# Resilient .env loader with built-in fallback (works even without python-dotenv installed)
def _load_env():
    try:
        from dotenv import load_dotenv
        load_dotenv(override=True)
    except ImportError:
        env_file = os.path.join(os.path.dirname(__file__), '.env')
        if os.path.exists(env_file):
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        os.environ[k.strip()] = v.strip().strip('"').strip("'")
_load_env()

from flask import Flask, jsonify, request, session, send_from_directory
from database.connection import get_db_connection
from database.init_db import init_db
from services.state_service import get_state_json
from routes.user_routes import user_bp
from routes.admin_routes import admin_bp
from routes.classroom_routes import classroom_bp
from routes.deck_routes import deck_bp
from routes.streak_routes import streak_bp
from routes.progress_routes import progress_bp
from routes.ai_routes import ai_bp
from routes.upload_routes import upload_bp
from routes.quiz_routes import quiz_bp
from routes.document_routes import document_bp
from routes.mistake_routes import mistake_bp

load_dotenv()

app = Flask(__name__, static_folder='.', static_url_path='')
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'flashlearn-super-secret-key-13579')
app.config.update(
    GOOGLE_CLIENT_ID=os.environ.get('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET=os.environ.get('GOOGLE_CLIENT_SECRET'),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=os.environ.get('FLASK_SESSION_COOKIE_SECURE', '0') == '1',
    PERMANENT_SESSION_LIFETIME=86400 * 30
)

# Ensure DB is initialized and seeded on start
init_db()

# Register blueprints
app.register_blueprint(user_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(classroom_bp)
app.register_blueprint(deck_bp)
app.register_blueprint(streak_bp)
app.register_blueprint(progress_bp)
app.register_blueprint(ai_bp)
app.register_blueprint(upload_bp)
app.register_blueprint(quiz_bp)
app.register_blueprint(document_bp)
app.register_blueprint(mistake_bp)

@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    return response

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/state', methods=['GET'])
def get_state():
    user_id = session.get('user_id')
    return jsonify(get_state_json(user_id))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)
