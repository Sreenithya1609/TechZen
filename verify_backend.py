import os
import unittest
import json
import sqlite3
from app import app
import database.connection
from database.init_db import init_db

class FlashLearnBackendTestCase(unittest.TestCase):
    def setUp(self):
        # Configure app for testing
        app.config['TESTING'] = True
        app.config['SECRET_KEY'] = 'test-secret'
        # Override the database path to a test db
        self.test_db_path = os.path.join(os.path.dirname(__file__), 'test_flashlearn.db')
        database.connection.DB_PATH = self.test_db_path
        
        # Initialize the test database
        init_db()
        self.client = app.test_client()

    def tearDown(self):
        # Remove test database file
        if os.path.exists(self.test_db_path):
            os.remove(self.test_db_path)

    def test_guest_state(self):
        # Retrieve state when guest
        response = self.client.get('/api/state')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIsNone(data['currentUser'])
        self.assertEqual(len(data['classrooms']), 3) # defaulted/seeded

    def test_auth_and_profile_flow(self):
        # 1. Register a student user
        resp = self.client.post('/api/auth/register', json={
            'name': 'Test Student',
            'email': 'student-test@gmail.com',
            'password': 'password123'
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(data['currentUser']['name'], 'Test Student')
        self.assertEqual(data['currentUser']['role'], 'student')

        # 2. Login again
        resp = self.client.post('/api/auth/login', json={
            'email': 'student-test@gmail.com',
            'password': 'password123'
        })
        self.assertEqual(resp.status_code, 200)

        # 3. Update profile
        resp = self.client.put('/api/auth/profile', json={
            'name': 'Updated Test Student',
            'email': 'student-test-new@gmail.com',
            'password': 'password1234'
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(data['currentUser']['name'], 'Updated Test Student')
        self.assertEqual(data['currentUser']['email'], 'student-test-new@gmail.com')

    def test_classroom_creation_and_join(self):
        # 1. Login as seeded teacher
        resp = self.client.post('/api/auth/login', json={
            'email': 'revathi@gmail.com',
            'password': '123'
        })
        self.assertEqual(resp.status_code, 200)

        # 2. Create classroom
        resp = self.client.post('/api/classrooms', json={
            'name': 'Advanced Quantum Mechanics',
            'subject': 'Physics'
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        
        # Check that class was added
        physics_class = next((c for c in data['classrooms'] if c['subject'] == 'Physics'), None)
        self.assertIsNotNone(physics_class)
        code = physics_class['code']

        # 3. Logout teacher
        self.client.post('/api/auth/logout')

        # 4. Login as student
        resp = self.client.post('/api/auth/login', json={
            'email': 'student@gmail.com',
            'password': '123'
        })
        self.assertEqual(resp.status_code, 200)

        # 5. Join classroom using code
        resp = self.client.post('/api/classrooms/join', json={
            'code': code
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertIn(physics_class['id'], data['studentJoinedClassrooms'])

    def test_deck_management(self):
        # 1. Login teacher
        self.client.post('/api/auth/login', json={
            'email': 'revathi@gmail.com',
            'password': '123'
        })

        # 2. Create custom deck
        resp = self.client.post('/api/decks', json={
            'title': 'My Organic Chemistry Notes',
            'subject': 'Chemistry',
            'cards': [
                {'question': 'What is the formula of Benzene?', 'answer': 'C6H6'},
                {'question': 'Define isomerism.', 'answer': 'Compounds with same formula but different structure.'}
            ]
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        
        deck = next((d for d in data['decks'] if d['title'] == 'My Organic Chemistry Notes'), None)
        self.assertIsNotNone(deck)
        self.assertEqual(len(deck['cards']), 2)
        deck_id = deck['id']

        # 3. Edit deck title
        resp = self.client.put(f'/api/decks/{deck_id}', json={
            'title': 'My Organic Chemistry Notes v2',
            'subject': 'Chemistry'
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        deck = next((d for d in data['decks'] if d['id'] == deck_id), None)
        self.assertEqual(deck['title'], 'My Organic Chemistry Notes v2')

        # 4. Delete deck
        resp = self.client.delete(f'/api/decks/{deck_id}')
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        deck = next((d for d in data['decks'] if d['id'] == deck_id), None)
        self.assertIsNone(deck)

    def test_strict_roles_assignment(self):
        # 1. Register varsha@gmail.com -> role should be STUDENT
        resp = self.client.post('/api/auth/register', json={
            'name': 'Varsha',
            'email': 'varsha@gmail.com',
            'password': '123'
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(data['currentUser']['role'], 'student')

        # 2. Register revathi@gmail.com -> role should be TEACHER
        # First pop session to allow fresh register
        self.client.post('/api/auth/logout')
        resp = self.client.post('/api/auth/register', json={
            'name': 'Revathi',
            'email': 'revathi@gmail.com',
            'password': '123'
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(data['currentUser']['role'], 'teacher')

    def test_teacher_only_api_security(self):
        # 1. Login as student
        self.client.post('/api/auth/login', json={
            'email': 'student@gmail.com',
            'password': '123'
        })

        # 2. Student tries to create classroom -> must get 403
        resp = self.client.post('/api/classrooms', json={
            'name': 'Hacking 101',
            'subject': 'Cybersecurity'
        })
        self.assertEqual(resp.status_code, 403)

        # 3. Student tries to view student report details -> must get 403
        resp = self.client.get('/api/students/usr-student-1/progress')
        self.assertEqual(resp.status_code, 403)

        # 4. Student tries to edit a deck -> must get 403
        resp = self.client.put('/api/decks/deck-1', json={
            'title': 'Hack Deck',
            'subject': 'Biology'
        })
        self.assertEqual(resp.status_code, 403)

        # 5. Student tries to delete a deck -> must get 403
        resp = self.client.delete('/api/decks/deck-1')
        self.assertEqual(resp.status_code, 403)

    def test_study_streak_logging(self):
        # 1. Login student
        self.client.post('/api/auth/login', json={
            'email': 'student@gmail.com',
            'password': '123'
        })

        # 2. Daily streak count should initially be 0 (no study activity recorded yet for student@gmail.com)
        resp = self.client.get('/api/state')
        data = json.loads(resp.data)
        self.assertEqual(data['dailyStreak']['count'], 0)

        # 3. Log a study action
        resp = self.client.post('/api/progress/study')
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(data['dailyStreak']['count'], 1)

    def test_student_own_deck_modification(self):
        # 1. Login student
        self.client.post('/api/auth/login', json={
            'email': 'student@gmail.com',
            'password': '123'
        })
        
        # 2. Create custom deck as student
        resp = self.client.post('/api/decks', json={
            'title': 'Eleanor Custom Deck',
            'subject': 'Biology',
            'cards': [{'question': 'Q', 'answer': 'A'}]
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        deck = next((d for d in data['decks'] if d['title'] == 'Eleanor Custom Deck'), None)
        self.assertIsNotNone(deck)
        deck_id = deck['id']

        # 3. Edit own deck -> must succeed
        resp = self.client.put(f'/api/decks/{deck_id}', json={
            'title': 'Eleanor Custom Deck v2',
            'subject': 'Biology'
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        deck = next((d for d in data['decks'] if d['id'] == deck_id), None)
        self.assertEqual(deck['title'], 'Eleanor Custom Deck v2')

        # 4. Delete own deck -> must succeed
        resp = self.client.delete(f'/api/decks/{deck_id}')
        self.assertEqual(resp.status_code, 200)

if __name__ == '__main__':
    unittest.main()
