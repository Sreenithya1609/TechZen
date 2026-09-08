from werkzeug.security import check_password_hash, generate_password_hash
from database.connection import get_db_connection

# Test password
test_password = 'Techzen_123'
hashed = generate_password_hash(test_password)
print(f'Generated hash: {hashed}')
print(f'Check against generated hash: {check_password_hash(hashed, test_password)}')

# Now check the actual stored password
conn = get_db_connection()
cursor = conn.execute('SELECT password FROM users WHERE email = ?', ('revathi@gmail.com',))
row = cursor.fetchone()
if row:
    stored_hash = row[0]
    print(f'\nStored hash from DB: {stored_hash}')
    print(f'Password check result: {check_password_hash(stored_hash, test_password)}')
else:
    print('User not found')
conn.close()
