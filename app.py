import os
from flask import Flask, jsonify, session, send_from_directory
from database.init_db import init_db
from services.state_service import get_state_json
from routes.user_routes import user_bp
from routes.classroom_routes import classroom_bp
from routes.deck_routes import deck_bp
from routes.streak_routes import streak_bp
from routes.progress_routes import progress_bp

app = Flask(__name__, static_folder='.', static_url_path='')
app.secret_key = 'flashlearn-super-secret-key-13579'

# Ensure DB is initialized and seeded on start
init_db()

# Register blueprints
app.register_blueprint(user_bp)
app.register_blueprint(classroom_bp)
app.register_blueprint(deck_bp)
app.register_blueprint(streak_bp)
app.register_blueprint(progress_bp)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/state', methods=['GET'])
def get_state():
    user_id = session.get('user_id')
    return jsonify(get_state_json(user_id))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
