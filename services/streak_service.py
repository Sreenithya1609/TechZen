import json
from datetime import datetime, timedelta
from database.connection import get_db_connection

def db_advance_clue(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT current_clue_index, solved, clues FROM daily_streaks WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    if row and not row['solved']:
        try:
            clues_list = json.loads(row['clues'])
            max_idx = max(0, len(clues_list) - 1)
        except Exception:
            max_idx = 3
            
        if row['current_clue_index'] < max_idx:
            cursor.execute("UPDATE daily_streaks SET current_clue_index = current_clue_index + 1 WHERE user_id = ?", (user_id,))
            conn.commit()
    conn.close()

def db_make_guess(user_id, guess):
    guess = str(guess).strip().upper()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT secret_word, solved, count FROM daily_streaks WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return None, False

    if row['solved']:
        conn.close()
        return True, True

    if guess == row['secret_word'].upper():
        cursor.execute(
            "UPDATE daily_streaks SET solved = 1, current_clue_index = 3 WHERE user_id = ?",
            (user_id,)
        )
        conn.commit()
        conn.close()
        record_study_activity(user_id)
        return True, True
    else:
        conn.close()
        return False, False

def record_study_activity(user_id):
    today_str = datetime.now().strftime("%Y-%m-%d")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Insert study date for this user. UNIQUE constraint prevents duplicates for the same day.
        cursor.execute(
            "INSERT OR IGNORE INTO study_activity (user_id, study_date) VALUES (?, ?)",
            (user_id, today_str)
        )
        conn.commit()
    except Exception as e:
        print(f"Error logging study activity: {e}")
    finally:
        conn.close()

def calculate_streak(user_id, conn):
    cursor = conn.cursor()
    cursor.execute("SELECT study_date FROM study_activity WHERE user_id = ? ORDER BY study_date DESC", (user_id,))
    rows = cursor.fetchall()
    if not rows:
        return 0

    # Parse dates
    study_dates = []
    for r in rows:
        try:
            d = datetime.strptime(r['study_date'], "%Y-%m-%d").date()
            study_dates.append(d)
        except Exception:
            continue

    if not study_dates:
        return 0

    today = datetime.now().date()
    yesterday = today - timedelta(days=1)
    
    most_recent = study_dates[0]
    
    # If the user has not studied today or yesterday, streak is broken.
    if most_recent < yesterday:
        return 0
        
    streak = 1
    current_date = most_recent
    for next_date in study_dates[1:]:
        diff = (current_date - next_date).days
        if diff == 1:
            streak += 1
            current_date = next_date
        elif diff == 0:
            continue
        else:
            break
            
    return streak
