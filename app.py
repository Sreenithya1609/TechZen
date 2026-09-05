import os
import re
import json
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
from routes.classroom_routes import classroom_bp
from routes.deck_routes import deck_bp
from routes.streak_routes import streak_bp
from routes.progress_routes import progress_bp

app = Flask(__name__, static_folder='.', static_url_path='')
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'flashlearn-super-secret-key-13579')

# Ensure DB is initialized and seeded on start
init_db()

# Register blueprints
app.register_blueprint(user_bp)
app.register_blueprint(classroom_bp)
app.register_blueprint(deck_bp)
app.register_blueprint(streak_bp)
app.register_blueprint(progress_bp)

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

def generate_fallback_cards(topic, level, count, is_notes=False):
    """Provides high-quality academic fallback flashcards when AI service is unavailable."""
    cleaned_topic = topic[:80].strip()
    words = [w.strip() for w in re.split(r'[\s,.;]+', cleaned_topic) if len(w) > 3][:5]
    
    fallback_templates = [
        ("What is the primary definition and core scope of {topic}?", 
         "The fundamental academic framework and foundational principles encompassing {topic}."),
        ("What are the key mechanisms and operational processes governing {topic}?", 
         "Structured methodologies, sequential workflows, and empirical systems that define {topic}."),
        ("Why is {topic} significant in contemporary scientific and academic study?", 
         "It provides foundational models for problem solving, critical analysis, and cross-disciplinary innovation."),
        ("What is a primary real-world application or case study of {topic}?", 
         "Practical deployment across research institutions, industrial systems, and analytical frameworks."),
        ("What are common misconceptions or challenges when studying {topic}?", 
         "Conflating surface-level terminology with underlying mechanistic principles.")
    ]
    
    cards = []
    for i in range(count):
        tpl_q, tpl_a = fallback_templates[i % len(fallback_templates)]
        sub_term = words[i % len(words)] if (words and i > 0) else cleaned_topic
        cards.append({
            'question': tpl_q.format(topic=sub_term),
            'answer': tpl_a.format(topic=sub_term)
        })
    return cards

@app.route('/api/ai/generate', methods=['POST'])
def generate_ai_flashcards():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Authentication required. Please sign in.'}), 401

    conn = get_db_connection()
    user = conn.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if not user:
        return jsonify({'error': 'Forbidden: User session invalid.'}), 403

    data = request.json or {}
    topic = data.get('topic', '').strip()
    level = data.get('level', 'Intermediate Mastery').strip()
    count = data.get('count', 5)
    is_notes = bool(data.get('is_notes', False))

    if not topic:
        return jsonify({'error': 'A subject topic or study content is required.'}), 400

    try:
        count = max(1, min(int(count), 20))
    except (TypeError, ValueError):
        return jsonify({'error': 'Question count must be an integer between 1 and 20.'}), 400

    api_key = os.environ.get('GEMINI_API_KEY')
    model = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')

    if not api_key or api_key == 'test-gemini-key':
        # Return fallback academic cards if no active API key
        if api_key != 'test-gemini-key':
            cards = generate_fallback_cards(topic, level, count, is_notes)
            return jsonify({'cards': cards, 'fallback': True})

    if is_notes:
        prompt = (
            f'Based on the following study material, create exactly {count} useful academic flashcards '
            f'that cover the key concepts, terms, and explanations. Do not assume outside info if not present in the study notes. '
            f'Study Material:\n"""\n{topic}\n"""\n\n'
            f'Return only valid JSON in this format: '
            '{"cards":[{"question":"...","answer":"..."}]}. '
            'Do not include Markdown code fences or extra text.'
        )
    else:
        prompt = (
            f'Create exactly {count} high-quality academic flashcards about "{topic}" at the '
            f'{level} level. Return only valid JSON in this format: '
            '{"cards":[{"question":"...","answer":"..."}]}. '
            'Do not include Markdown code fences or extra text.'
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
        with urllib_request.urlopen(api_request, timeout=30) as response:
            response_data = json.loads(response.read().decode('utf-8'))
        generated_text = response_data['candidates'][0]['content']['parts'][0]['text']
        
        # Clean markdown fences if any
        clean_text = re.sub(r'^```(?:json)?\s*', '', generated_text.strip())
        clean_text = re.sub(r'\s*```$', '', clean_text.strip())
        
        generated_data = json.loads(clean_text)
        cards = generated_data.get('cards', [])
        cards = [
            {'question': str(card.get('question', '')).strip(), 'answer': str(card.get('answer', '')).strip()}
            for card in cards
            if card.get('question') and card.get('answer')
        ][:count]
        
        if not cards:
            raise ValueError('Gemini returned empty card list.')
            
        return jsonify({'cards': cards})
    except Exception as exc:
        print(f'Gemini generation fallback triggered: {exc}')
        cards = generate_fallback_cards(topic, level, count, is_notes)
        return jsonify({'cards': cards, 'fallback': True})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
