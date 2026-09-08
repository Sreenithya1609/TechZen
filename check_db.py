from database.connection import get_db_connection

conn = get_db_connection()
cursor = conn.execute('SELECT email, password FROM users')
rows = cursor.fetchall()
print(f'Total users: {len(rows)}')
for row in rows:
    print(f'Email: {row[0]}, Has password hash: {bool(row[1])}')
conn.close()
