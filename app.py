import os
import json
from urllib import error as urllib_error
from urllib import request as urllib_request
from flask import Flask, jsonify, request, session, send_from_directory
from database.connection import get_db_connection
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

@app.route('/api/ai/generate', methods=['POST'])
def generate_ai_flashcards():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not logged in'}), 401

    conn = get_db_connection()
    user = conn.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if not user:
        return jsonify({'error': 'Forbidden: Invalid user.'}), 403

    data = request.json or {}
    topic = data.get('topic', '').strip()
    level = data.get('level', 'Intermediate Mastery').strip()
    count = data.get('count', 5)
    is_notes = data.get('is_notes', False)

    if not topic:
        return jsonify({'error': 'A topic or content is required.'}), 400

    try:
        count = max(1, min(int(count), 20))
    except (TypeError, ValueError):
        return jsonify({'error': 'Question count must be a number.'}), 400

    api_key = os.environ.get('GEMINI_API_KEY')
    model = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
    if not api_key:
        return jsonify({'error': 'GEMINI_API_KEY is not configured on the server.'}), 503

    if is_notes:
        prompt = (
            f'Based on the following study material, create exactly {count} useful academic flashcards '
            f'that cover the key concepts, terms, and explanations. Do not assume outside info if not present in the study notes. '
            f'Study Material:\n"""\n{topic}\n"""\n\n'
            f'Return only valid JSON in this format: '
            '{"cards":[{"question":"...","answer":"..."}]}. '
            'Do not include Markdown, code fences, or extra text.'
        )
    else:
        prompt = (
            f'Create exactly {count} useful academic flashcards about "{topic}" at the '
            f'{level} level. Return only valid JSON in this format: '
            '{"cards":[{"question":"...","answer":"..."}]}. '
            'Do not include Markdown, code fences, or extra text.'
        )
        
    payload = json.dumps({
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {'responseMimeType': 'application/json'}
    }).encode('utf-8')
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
    api_request = urllib_request.Request(
        url,
        data=payload,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )

    try:
        with urllib_request.urlopen(api_request, timeout=45) as response:
            response_data = json.loads(response.read().decode('utf-8'))
        generated_text = response_data['candidates'][0]['content']['parts'][0]['text']
        generated_data = json.loads(generated_text)
        cards = generated_data.get('cards', [])
        cards = [
            {'question': str(card.get('question', '')).strip(), 'answer': str(card.get('answer', '')).strip()}
            for card in cards
            if card.get('question') and card.get('answer')
        ][:count]
        if not cards:
            raise ValueError('Gemini returned no valid flashcards.')
        return jsonify({'cards': cards})
    except (urllib_error.HTTPError, urllib_error.URLError, KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as exc:
        print(f'Gemini generation failed: {exc}')
        return jsonify({'error': 'The AI service could not generate flashcards. Please try again.'}), 502

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
