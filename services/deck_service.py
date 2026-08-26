import uuid
from database.connection import get_db_connection

def db_create_deck(user_id, title, subject, cards, classroom_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT name FROM users WHERE id = ?", (user_id,))
    user_name_row = cursor.fetchone()
    if not user_name_row:
        conn.close()
        return None, 'User not found'
    user_name = user_name_row['name']

    deck_id = f"deck-{int(uuid.uuid4().time_low)}"
    cursor.execute(
        "INSERT INTO decks (id, title, subject, creator_name, classroom_id) VALUES (?, ?, ?, ?, ?)",
        (deck_id, title, subject, user_name, classroom_id)
    )

    # Insert cards
    card_tuples = []
    for idx, card in enumerate(cards):
        card_id = f"card-{deck_id}-{idx}"
        q = card.get('question', '').strip()
        a = card.get('answer', '').strip()
        if q and a:
            card_tuples.append((card_id, deck_id, q, a))

    if card_tuples:
        cursor.executemany("INSERT INTO cards (id, deck_id, question, answer) VALUES (?, ?, ?, ?)", card_tuples)

    conn.commit()
    conn.close()
    return deck_id, None

def db_update_deck(deck_id, title, subject, cards):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE decks SET title = ?, subject = ? WHERE id = ?", (title, subject, deck_id))
    
    # Remove existing cards
    cursor.execute("DELETE FROM cards WHERE deck_id = ?", (deck_id,))
    
    # Insert updated card list
    card_tuples = []
    for idx, card in enumerate(cards):
        card_id = f"card-{deck_id}-{idx}"
        q = card.get('question', '').strip()
        a = card.get('answer', '').strip()
        if q and a:
            card_tuples.append((card_id, deck_id, q, a))

    if card_tuples:
        cursor.executemany("INSERT INTO cards (id, deck_id, question, answer) VALUES (?, ?, ?, ?)", card_tuples)

    conn.commit()
    conn.close()

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
