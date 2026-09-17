"""
Flashcard generation service for course documents.
Converts extracted document text into high-quality question-answer flashcard decks.
"""

import json
import re
from services.ai_service import call_gemini_api
from services.document_service import chunk_text

def generate_flashcards_from_text(text, count=6, level="Intermediate Mastery"):
    """
    Synthesizes academic flashcards from document text using Gemini or fallback extractor.
    Returns:
        list of dicts: [{"question": str, "answer": str, "difficulty": str}]
    """
    count = max(1, min(int(count), 20))
    chunks = chunk_text(text, max_words=1200, overlap=100)
    
    # Process primary chunk (or up to 2 chunks if count > 8)
    primary_text = chunks[0] if chunks else text
    if len(chunks) > 1 and count > 8:
        primary_text = f"{chunks[0]}\n\n---\n\n{chunks[1]}"

    prompt = (
        "You are an expert educational content generator.\n\n"
        "Create high-quality flashcards from the provided learning material.\n\n"
        f"Learning Material:\n\"\"\"\n{primary_text[:4000]}\n\"\"\"\n\n"
        f"Target Flashcard Count: {count}\n"
        f"Academic Rigor Level: {level}\n\n"
        "Requirements:\n"
        "- Generate clear, precise questions.\n"
        "- Generate accurate, factual answers grounded strictly in the provided text.\n"
        "- Focus on core concepts, definitions, and key principles.\n"
        "- Avoid duplicate questions.\n"
        "- Do not invent information.\n"
        "- Keep answers concise (1-3 sentences).\n"
        "- Assign difficulty as 'easy', 'medium', or 'hard'.\n\n"
        "Return JSON only in this exact format:\n"
        "[\n"
        "  {\n"
        '    "question": "What is ...?",\n'
        '    "answer": "...",\n'
        '    "difficulty": "medium"\n'
        "  }\n"
        "]\n"
        "Do not include Markdown code fences or extra text."
    )

    clean_text, err = call_gemini_api(prompt, response_mime_type="application/json")
    if not err and clean_text:
        try:
            parsed = json.loads(clean_text)
            if isinstance(parsed, dict):
                parsed = (
                    parsed.get('cards') or
                    parsed.get('flashcards') or
                    parsed.get('questions') or
                    next((v for v in parsed.values() if isinstance(v, list)), [])
                )

            if isinstance(parsed, list):
                cards = []
                seen_q = set()
                for item in parsed:
                    if isinstance(item, dict):
                        q = str(item.get('question', '')).strip()
                        a = str(item.get('answer', '')).strip()
                        diff = str(item.get('difficulty', 'medium')).lower().strip()
                        if diff not in ('easy', 'medium', 'hard'):
                            diff = 'medium'

                        if q and a and q.lower() not in seen_q:
                            seen_q.add(q.lower())
                            cards.append({'question': q, 'answer': a, 'difficulty': diff})

                if cards:
                    return cards[:count]
        except (json.JSONDecodeError, TypeError, ValueError):
            pass

    # Resilient offline fallback generator
    return generate_fallback_cards_from_document(text, count=count, level=level)


def generate_fallback_cards_from_document(text, count=5, level="Intermediate Mastery"):
    """
    Extracts key academic statements and definitions from document text when offline.
    """
    # Clean sentences
    raw_sentences = re.split(r'(?<=[.!?])\s+', text)
    sentences = [s.strip() for s in raw_sentences if len(s.strip()) > 25 and not s.strip().startswith('#')]

    cards = []
    seen_q = set()

    # Heuristic 1: Look for definition patterns ("X is defined as Y", "X refers to Y", "X is a Y", "X means Y")
    def_patterns = [
        r'^(?P<concept>[A-Z][A-Za-z0-9\s]{2,35}?)\s+(?:is defined as|refers to|is a|are)\s+(?P<desc>.+)$',
        r'^(?P<concept>[A-Z][A-Za-z0-9\s]{2,35}?):\s+(?P<desc>.+)$',
        r'^(?:The function of|The purpose of)\s+(?P<concept>[A-Za-z0-9\s]{2,35}?)\s+(?:is to|serves to)\s+(?P<desc>.+)$'
    ]

    for sent in sentences:
        for pat in def_patterns:
            m = re.match(pat, sent, re.IGNORECASE)
            if m:
                concept = m.group('concept').strip(' :.,')
                desc = m.group('desc').strip(' .')
                q = f"What is the definition and core significance of {concept}?"
                a = f"{concept} {desc}."
                if q.lower() not in seen_q and len(concept) < 45:
                    seen_q.add(q.lower())
                    cards.append({'question': q, 'answer': a, 'difficulty': 'medium'})
                    break
        if len(cards) >= count:
            break

    # Heuristic 2: If we still need cards, construct question pairs from salient sentences
    diff_cycle = ['easy', 'medium', 'hard']
    diff_idx = 0

    if len(cards) < count:
        for idx, sent in enumerate(sentences):
            words = [w for w in re.findall(r'\b[A-Za-z]{4,}\b', sent) if w.lower() not in ('this', 'that', 'with', 'from', 'have', 'been', 'which', 'their')]
            if words:
                key_topic = words[0].capitalize()
                q = f"According to the text, what principle governs {key_topic}?"
                a = sent
                if q.lower() not in seen_q:
                    seen_q.add(q.lower())
                    cards.append({'question': q, 'answer': a, 'difficulty': diff_cycle[diff_idx % len(diff_cycle)]})
                    diff_idx += 1
            if len(cards) >= count:
                break

    # Heuristic 3: If document is very brief, generate standard conceptual cards
    if not cards:
        cards.append({
            'question': 'What are the primary themes discussed in the uploaded document?',
            'answer': text[:200] + '...',
            'difficulty': 'medium'
        })

    return cards[:count]
