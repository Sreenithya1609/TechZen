"""
Quiz generation service for FlashLearn.
Converts flashcard decks into multiple-choice practice quizzes (MCQs) with AI-generated distractors.
Guarantees plausible, non-duplicate choices and randomized option positioning.
"""

import json
import random
from database.connection import get_db_connection
from services.ai_service import call_gemini_api

def generate_quiz_from_deck(deck_id, user_id):
    """
    Generates a multiple-choice practice quiz from a flashcard deck.
    
    Returns:
        (quiz_dict, error_msg, status_code)
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Fetch Deck
    cursor.execute("SELECT id, title, subject, creator_id, classroom_id FROM decks WHERE id = ?", (str(deck_id),))
    deck = cursor.fetchone()
    if not deck:
        conn.close()
        return None, "Deck not found.", 404

    # 2. Fetch Cards
    cursor.execute("SELECT id, question, answer FROM cards WHERE deck_id = ? ORDER BY id ASC", (str(deck_id),))
    cards_rows = cursor.fetchall()
    conn.close()

    if not cards_rows:
        return None, "Deck has no flashcards to generate a quiz from.", 400

    cards = [dict(r) for r in cards_rows]
    other_answers_pool = [c['answer'] for c in cards]

    quiz_questions = []
    
    for idx, card in enumerate(cards[:10]):
        q_text = card['question']
        correct_ans = card['answer']
        
        distractors, explanation = _generate_distractors(q_text, correct_ans, other_answers_pool)
        
        # Build 4 unique options
        options = _assemble_unique_options(correct_ans, distractors, other_answers_pool, fallback_prefix=q_text[:20])
        
        # Shuffle options randomly
        random.shuffle(options)
        correct_index = options.index(correct_ans)

        quiz_questions.append({
            'id': f"quiz-q-{idx + 1}",
            'card_id': card['id'],
            'question': q_text,
            'options': options,
            'correct_answer': correct_ans,
            'correct_index': correct_index,
            'explanation': explanation or f"The accurate concept is: {correct_ans}"
        })

    return {
        'deck_id': deck['id'],
        'deck_title': deck['title'],
        'subject': deck['subject'],
        'total_questions': len(quiz_questions),
        'quiz': quiz_questions
    }, None, 200


def _generate_distractors(question, correct_answer, other_answers):
    """
    Asks Gemini for 3 plausible, believable distractors.
    """
    prompt = (
        "You are an expert academic multiple-choice test author.\n\n"
        f"Flashcard Question: {question}\n"
        f"Correct Answer: {correct_answer}\n\n"
        "Generate exactly 3 believable, plausible, but incorrect multiple-choice options (distractors) related to this topic.\n"
        "Requirements:\n"
        "1. Distractors must be believable academic misconceptions or closely related terms.\n"
        "2. Do NOT duplicate or rephrase the correct answer.\n"
        "3. All 3 distractors must be distinct and mutually exclusive.\n"
        "4. Keep option length and tone comparable to the correct answer.\n"
        "5. Return ONLY valid JSON in this exact structure:\n"
        "{\n"
        '  "distractors": ["Plausible Wrong 1", "Plausible Wrong 2", "Plausible Wrong 3"],\n'
        '  "explanation": "Brief 1-sentence explanation of why the correct answer is accurate."\n'
        "}\n"
        "Do not include Markdown code fences or extra text."
    )

    clean_text, err = call_gemini_api(prompt, response_mime_type="application/json")
    if not err and clean_text:
        try:
            data = json.loads(clean_text)
            distractors = data.get('distractors', [])
            explanation = data.get('explanation', '')
            if isinstance(distractors, list) and len(distractors) >= 3:
                cleaned_dist = [str(d).strip() for d in distractors if str(d).strip()]
                return cleaned_dist[:3], str(explanation).strip()
        except (json.JSONDecodeError, TypeError, ValueError):
            pass

    # Resilient fallback distractors using other answers from the deck
    fallback_distractors = [a for a in other_answers if a.strip().lower() != correct_answer.strip().lower()]
    return fallback_distractors, f"Concept explanation: {correct_answer}"


def _assemble_unique_options(correct_answer, candidate_distractors, pool_answers, fallback_prefix=""):
    """
    Assembles precisely 4 unique multiple-choice options without duplicates.
    """
    options = [correct_answer]
    seen_normalized = {correct_answer.strip().lower()}

    # Add candidate distractors
    for d in candidate_distractors:
        d_clean = d.strip()
        norm = d_clean.lower()
        if d_clean and norm not in seen_normalized:
            seen_normalized.add(norm)
            options.append(d_clean)
        if len(options) == 4:
            break

    # If fewer than 4, borrow from other answers in the deck
    if len(options) < 4:
        for pa in pool_answers:
            pa_clean = pa.strip()
            norm = pa_clean.lower()
            if pa_clean and norm not in seen_normalized:
                seen_normalized.add(norm)
                options.append(pa_clean)
            if len(options) == 4:
                break

    # If still fewer than 4, generate domain-adjusted variants
    synthetic_suffixes = [
        " (Alternative hypothesis with reversed mechanism)",
        " (Common theoretical misconception)",
        " (Non-applicable secondary framework)"
    ]
    suffix_idx = 0
    while len(options) < 4:
        synth = f"{correct_answer[:45]}{synthetic_suffixes[suffix_idx % len(synthetic_suffixes)]}"
        suffix_idx += 1
        if synth.lower() not in seen_normalized:
            seen_normalized.add(synth.lower())
            options.append(synth)

    return options[:4]
