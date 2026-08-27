import uuid
from database.connection import get_db_connection

def sanitize_cards(cards):
    valid_cards = []
    if not isinstance(cards, list):
        return valid_cards
        
    for card in cards:
        if isinstance(card, dict):
            q = str(card.get('question', '')).strip()
            a = str(card.get('answer', '')).strip()
            if q and a:
                valid_cards.append({'question': q, 'answer': a})
    return valid_cards

def db_create_deck(user_id, title, subject, cards, classroom_id=None):
    title = title.strip()
    subject = subject.strip()

    if len(title) < 2 or len(title) > 120:
        return None, 'Deck title must be between 2 and 120 characters.'
    if len(subject) < 2 or len(subject) > 60:
        return None, 'Subject tag must be between 2 and 60 characters.'

    sanitized_cards = sanitize_cards(cards)
    if not sanitized_cards:
        return None, 'A flashcard deck must contain at least one valid question & answer card.'

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT name, role FROM users WHERE id = ?", (user_id,))
    user_row = cursor.fetchone()
    if not user_row:
        conn.close()
        return None, 'User not found.'
        
    user_name = user_row['name']
    user_role = user_row['role']

    # If assigning to classroom, verify classroom exists and user is teacher
    if classroom_id:
        if user_role != 'teacher':
            conn.close()
            return None, 'Forbidden: Only faculty administrators can publish decks to classrooms.'
        cursor.execute("SELECT id FROM classrooms WHERE id = ?", (classroom_id,))
        if not cursor.fetchone():
            conn.close()
            return None, 'Target classroom does not exist.'

    deck_id = f"deck-{int(uuid.uuid4().time_low)}"
    cursor.execute(
        "INSERT INTO decks (id, title, subject, creator_name, classroom_id) VALUES (?, ?, ?, ?, ?)",
        (deck_id, title, subject, user_name, classroom_id if classroom_id else None)
    )

    card_tuples = []
    for idx, card in enumerate(sanitized_cards):
        card_id = f"card-{deck_id}-{idx + 1}"
        card_tuples.append((card_id, deck_id, card['question'], card['answer']))

    cursor.executemany("INSERT INTO cards (id, deck_id, question, answer) VALUES (?, ?, ?, ?)", card_tuples)

    conn.commit()
    conn.close()
    return deck_id, None

def db_update_deck(deck_id, title, subject, cards=None):
    title = title.strip()
    subject = subject.strip()

    if len(title) < 2 or len(title) > 120:
        return False, 'Deck title must be between 2 and 120 characters.'
    if len(subject) < 2 or len(subject) > 60:
        return False, 'Subject tag must be between 2 and 60 characters.'

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE decks SET title = ?, subject = ? WHERE id = ?", (title, subject, deck_id))
    
    if cards is not None:
        sanitized_cards = sanitize_cards(cards)
        if sanitized_cards:
            cursor.execute("DELETE FROM cards WHERE deck_id = ?", (deck_id,))
            card_tuples = []
            for idx, card in enumerate(sanitized_cards):
                card_id = f"card-{deck_id}-{idx + 1}"
                card_tuples.append((card_id, deck_id, card['question'], card['answer']))
            cursor.executemany("INSERT INTO cards (id, deck_id, question, answer) VALUES (?, ?, ?, ?)", card_tuples)

    conn.commit()
    conn.close()
    return True, None

def db_delete_deck(deck_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM decks WHERE id = ?", (deck_id,))
    if not cursor.fetchone():
        conn.close()
        return False

    cursor.execute("DELETE FROM decks WHERE id = ?", (deck_id,))
    conn.commit()
    conn.close()
    return True
