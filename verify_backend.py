import os
import unittest
import unittest.mock
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
        self.original_gemini_api_key = os.environ.get('GEMINI_API_KEY')
        os.environ['GEMINI_API_KEY'] = 'test-gemini-key'
        # Override the database path to a test db
        self.test_db_path = os.path.join(os.path.dirname(__file__), 'test_flashlearn.db')
        database.connection.DB_PATH = self.test_db_path
        
        # Initialize the test database
        init_db()
        self.client = app.test_client()

    def tearDown(self):
        if self.original_gemini_api_key is None:
            os.environ.pop('GEMINI_API_KEY', None)
        else:
            os.environ['GEMINI_API_KEY'] = self.original_gemini_api_key
        # Remove test database file
        if os.path.exists(self.test_db_path):
            os.remove(self.test_db_path)

    def test_guest_state(self):
        response = self.client.get('/api/state')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIsNone(data['currentUser'])
        self.assertEqual(len(data['classrooms']), 3)

    def test_auth_and_profile_flow(self):
        # 1. Register a student user
        resp = self.client.post('/api/auth/register', json={
            'name': 'Test Student',
            'email': 'student-test@gmail.com',
            'password': 'Password123!'
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(data['currentUser']['name'], 'Test Student')
        self.assertEqual(data['currentUser']['role'], 'student')

        # 2. Login again
        resp = self.client.post('/api/auth/login', json={
            'email': 'student-test@gmail.com',
            'password': 'Password123!'
        })
        self.assertEqual(resp.status_code, 200)

        # 3. Update profile
        resp = self.client.put('/api/auth/profile', json={
            'name': 'Updated Test Student',
            'email': 'student-test-new@gmail.com',
            'password': 'Password1234!'
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(data['currentUser']['name'], 'Updated Test Student')
        self.assertEqual(data['currentUser']['email'], 'student-test-new@gmail.com')

    def test_input_validations(self):
        # Invalid email
        resp = self.client.post('/api/auth/register', json={
            'name': 'Invalid Email User',
            'email': 'not-an-email',
            'password': 'Password123!'
        })
        self.assertEqual(resp.status_code, 400)

        # Short password
        resp = self.client.post('/api/auth/register', json={
            'name': 'Short Pass User',
            'email': 'valid@domain.com',
            'password': '1'
        })
        self.assertEqual(resp.status_code, 400)

    def test_classroom_creation_and_join(self):
        # 1. Login as seeded teacher
        resp = self.client.post('/api/auth/login', json={
            'email': 'revathi@gmail.com',
            'password': 'Password123!'
        })
        self.assertEqual(resp.status_code, 200)

        # 2. Create classroom
        resp = self.client.post('/api/classrooms', json={ 
            'name': 'Advanced Quantum Mechanics',
            'subject': 'Physics'
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        
        physics_class = next((c for c in data['classrooms'] if c['subject'] == 'Physics'), None)
        self.assertIsNotNone(physics_class)
        code = physics_class['code']

        # 3. Logout teacher
        self.client.post('/api/auth/logout')

        # 4. Login as student
        resp = self.client.post('/api/auth/login', json={
            'email': 'student@gmail.com',
            'password': 'Password123!'
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
            'password': 'Password123!'
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
            'password': 'Password123!'
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(data['currentUser']['role'], 'student')

        # 2. Register revathi@gmail.com -> role should be TEACHER
        self.client.post('/api/auth/logout')
        resp = self.client.post('/api/auth/register', json={
            'name': 'Revathi',
            'email': 'revathi@gmail.com',
            'password': 'Password123!'
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(data['currentUser']['role'], 'teacher')

    def test_teacher_only_api_security(self):
        # 1. Login as student
        self.client.post('/api/auth/login', json={
            'email': 'student@gmail.com',
            'password': 'Password123!'
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
            'password': 'Password123!'
        })

        # 2. Daily streak count should initially be 0
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
            'password': 'Password123!'
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

    @unittest.mock.patch('urllib.request.urlopen')
    def test_ai_flashcard_generation_teacher(self, mock_urlopen):
        mock_response = unittest.mock.Mock()
        mock_response.read.return_value = json.dumps({
            'candidates': [{
                'content': {
                    'parts': [{
                        'text': '{"cards": [{"question": "Q1", "answer": "A1"}, {"question": "Q2", "answer": "A2"}]}'
                    }]
                }
            }]
        }).encode('utf-8')
        mock_urlopen.return_value.__enter__.return_value = mock_response

        # Login as teacher
        self.client.post('/api/auth/login', json={
            'email': 'revathi@gmail.com',
            'password': 'Password123!'
        })

        resp = self.client.post('/api/ai/generate', json={
            'topic': 'Cloud computing',
            'level': 'Intermediate Mastery',
            'count': 2
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(len(data['cards']), 2)
        self.assertEqual(data['cards'][0]['question'], 'Q1')

    @unittest.mock.patch('urllib.request.urlopen')
    def test_ai_flashcard_generation_student(self, mock_urlopen):
        mock_response = unittest.mock.Mock()
        mock_response.read.return_value = json.dumps({
            'candidates': [{
                'content': {
                    'parts': [{
                        'text': '{"cards": [{"question": "SQ1", "answer": "SA1"}]}'
                    }]
                }
            }]
        }).encode('utf-8')
        mock_urlopen.return_value.__enter__.return_value = mock_response

        # Login as student
        self.client.post('/api/auth/login', json={
            'email': 'student@gmail.com',
            'password': 'Password123!'
        })

        resp = self.client.post('/api/ai/generate', json={
            'topic': 'These are my custom study notes.',
            'count': 1,
            'is_notes': True
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(len(data['cards']), 1)
        self.assertEqual(data['cards'][0]['question'], 'SQ1')

    def test_student_lagging_performance(self):
        # Login as teacher Revathi
        login_resp = self.client.post('/api/auth/login', json={
            'email': 'revathi@gmail.com',
            'password': 'Password123!'
        })
        self.assertEqual(login_resp.status_code, 200)

        # Query all student performance
        perf_resp = self.client.get('/api/teacher/student-performance')
        self.assertEqual(perf_resp.status_code, 200)
        students_perf = json.loads(perf_resp.data)
        self.assertTrue(len(students_perf) > 0)

        for student in students_perf:
            self.assertIn('studentId', student)
            self.assertIn('studentName', student)
            self.assertIn('subjects', student)
            self.assertIn('laggingSubjects', student)
            for sub in student['subjects']:
                self.assertIn('subject', sub)
                self.assertIn('accuracy', sub)
                self.assertIn('status', sub)
                self.assertIn(sub['status'], ['GOOD', 'LAGGING', 'NO_ATTEMPTS'])

    def test_google_auth_endpoints(self):
        # 1. Config endpoint
        config_resp = self.client.get('/api/auth/google/config')
        self.assertEqual(config_resp.status_code, 200)
        config_data = json.loads(config_resp.data)
        self.assertIn('clientId', config_data)
        self.assertIn('configured', config_data)

        # 2. Missing token
        err_resp = self.client.post('/api/auth/google', json={})
        self.assertEqual(err_resp.status_code, 400)

        # 3. Demo token auto-registers student
        demo_resp = self.client.post('/api/auth/google', json={
            'credential': 'demo-google-token',
            'demo_email': 'alex.google@domain.edu',
            'demo_name': 'Alex Google'
        })
        self.assertEqual(demo_resp.status_code, 200)
        user_state = json.loads(demo_resp.data)
        self.assertEqual(user_state['currentUser']['email'], 'alex.google@domain.edu')
        self.assertEqual(user_state['currentUser']['name'], 'Alex Google')
        self.assertEqual(user_state['currentUser']['role'], 'student')

        # 4. Google login with existing seeded teacher email
        teacher_google_resp = self.client.post('/api/auth/google', json={
            'credential': 'demo-google-token',
            'demo_email': 'revathi@gmail.com',
            'demo_name': 'Revathi Faculty'
        })
        self.assertEqual(teacher_google_resp.status_code, 200)
        t_state = json.loads(teacher_google_resp.data)
        self.assertEqual(t_state['currentUser']['role'], 'teacher')

        # 5. Mock Google Token verification via urllib
        mock_response = unittest.mock.MagicMock()
        mock_response.read.return_value = json.dumps({
            'aud': os.environ.get('GOOGLE_CLIENT_ID', '').strip(),
            'email': 'newstudent@gmail.com',
            'name': 'New Google Student',
            'sub': 'google-123456789',
            'email_verified': 'true'
        }).encode('utf-8')
        mock_response.__enter__.return_value = mock_response

        with unittest.mock.patch('urllib.request.urlopen', return_value=mock_response):
            real_mock_resp = self.client.post('/api/auth/google', json={
                'credential': 'valid-google-mock-jwt'
            })
            self.assertEqual(real_mock_resp.status_code, 200)
            mock_data = json.loads(real_mock_resp.data)
            self.assertEqual(mock_data['currentUser']['email'], 'newstudent@gmail.com')
            self.assertEqual(mock_data['currentUser']['name'], 'New Google Student')

if __name__ == '__main__':
    unittest.main()

