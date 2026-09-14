import os
import io
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
        # Ensure any open connections are garbage-collected on Windows
        import gc, time
        gc.collect()
        if os.path.exists(self.test_db_path):
            for _ in range(5):
                try:
                    os.remove(self.test_db_path)
                    break
                except (PermissionError, OSError):
                    time.sleep(0.05)
                    gc.collect()

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
        # 1. Login as seeded admin
        resp = self.client.post('/api/auth/login', json={
            'email': 'revathi@gmail.com',
            'password': 'Techzen_123'
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

        # 3. Logout admin
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
        # 1. Login admin/teacher
        self.client.post('/api/auth/login', json={
            'email': 'revathi@gmail.com',
            'password': 'Techzen_123'
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

    def test_public_registration_cannot_escalate_role(self):
        # 1. Register varsha@gmail.com -> role must unconditionally be STUDENT
        resp = self.client.post('/api/auth/register', json={
            'name': 'Varsha',
            'email': 'varsha@gmail.com',
            'password': 'Password123!'
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(data['currentUser']['role'], 'student')
        self.assertEqual(data['currentUser']['teacherStatus'], 'none')

        # 2. Malicious payload attempting role='admin' escalation must be ignored
        self.client.post('/api/auth/logout')
        resp = self.client.post('/api/auth/register', json={
            'name': 'Hacker Admin',
            'email': 'hacker-admin@gmail.com',
            'password': 'Password123!',
            'role': 'admin'
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(data['currentUser']['role'], 'student')
        self.assertEqual(data['currentUser']['teacherStatus'], 'none')

        # 3. Payload attempting role='teacher' escalation is assigned student role with pending review
        self.client.post('/api/auth/logout')
        resp = self.client.post('/api/auth/register', json={
            'name': 'Hacker Teacher',
            'email': 'hacker-teacher@gmail.com',
            'password': 'Password123!',
            'role': 'teacher'
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(data['currentUser']['role'], 'student')
        self.assertEqual(data['currentUser']['teacherStatus'], 'pending')

    def test_registration_flow_and_validation(self):
        # Step 2.2 — Type checks before .strip()
        # Invalid Name type
        resp = self.client.post('/api/auth/register', json={
            'name': 12345,
            'email': 'test-type@gmail.com',
            'password': 'Password123!'
        })
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(json.loads(resp.data).get('code'), 'INVALID_NAME')

        # Invalid Email type
        resp = self.client.post('/api/auth/register', json={
            'name': 'Valid Name',
            'email': ['not', 'a', 'string'],
            'password': 'Password123!'
        })
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(json.loads(resp.data).get('code'), 'INVALID_EMAIL')

        # Invalid Password type
        resp = self.client.post('/api/auth/register', json={
            'name': 'Valid Name',
            'email': 'valid-email@gmail.com',
            'password': 999999
        })
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(json.loads(resp.data).get('code'), 'INVALID_PASSWORD')

        # Invalid Role type
        resp = self.client.post('/api/auth/register', json={
            'name': 'Valid Name',
            'email': 'valid-email@gmail.com',
            'password': 'Password123!',
            'role': 123
        })
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(json.loads(resp.data).get('code'), 'INVALID_ROLE')

        # Invalid Role value
        resp = self.client.post('/api/auth/register', json={
            'name': 'Valid Name',
            'email': 'valid-email@gmail.com',
            'password': 'Password123!',
            'role': 'super_admin'
        })
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(json.loads(resp.data).get('code'), 'INVALID_ROLE')

        # Step 2.1 — Successful Registration
        resp = self.client.post('/api/auth/register', json={
            'name': 'Prof Candidate',
            'email': 'candidate@school.edu',
            'password': 'Password123!',
            'role': 'teacher'
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(data['currentUser']['role'], 'student')
        self.assertEqual(data['currentUser']['teacherStatus'], 'pending')
        # Step 2.3 — Password never returned in API response
        self.assertNotIn('password', data['currentUser'])
        self.assertNotIn('password', data)

        # Step 2.1 — Duplicate Email Check
        resp_dup = self.client.post('/api/auth/register', json={
            'name': 'Duplicate Person',
            'email': 'candidate@school.edu',
            'password': 'Password123!',
            'role': 'student'
        })
        self.assertEqual(resp_dup.status_code, 400)
        self.assertEqual(json.loads(resp_dup.data).get('code'), 'EMAIL_EXISTS')

        # Verify Teacher Request appears in Admin Dashboard
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        resp_admin = self.client.get('/api/admin/teacher-requests?status=pending')
        self.assertEqual(resp_admin.status_code, 200)
        reqs = json.loads(resp_admin.data).get('requests', [])
        target_req = next((r for r in reqs if r['email'] == 'candidate@school.edu'), None)
        self.assertIsNotNone(target_req)
        self.assertEqual(target_req['teacher_status'], 'pending')

        # Admin approves the request
        cand_id = target_req['id']
        resp_appr = self.client.post(f'/api/admin/teacher-requests/{cand_id}/approve')
        self.assertEqual(resp_appr.status_code, 200)

        # Candidate now logs in and has teacher role
        self.client.post('/api/auth/login', json={'email': 'candidate@school.edu', 'password': 'Password123!'})
        resp_state = self.client.get('/api/state')
        self.assertEqual(json.loads(resp_state.data)['currentUser']['role'], 'teacher')

    def test_admin_teacher_student_login_history(self):
        # 1. Student logs in
        self.client.post('/api/auth/login', json={'email': 'student@gmail.com', 'password': 'Password123!'})

        # 2. Student cannot access admin login history (403)
        resp_forbidden = self.client.get('/api/admin/login-history')
        self.assertEqual(resp_forbidden.status_code, 403)

        # 3. Admin logs in
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})

        # 4. Admin accesses login history
        resp = self.client.get('/api/admin/login-history')
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertIn('logins', data)
        self.assertIn('stats', data)
        self.assertGreater(len(data['logins']), 0)

        # 5. Filter by student role
        resp_students = self.client.get('/api/admin/login-history?role=student')
        self.assertEqual(resp_students.status_code, 200)
        data_students = json.loads(resp_students.data)
        for item in data_students['logins']:
            self.assertEqual(item['role'], 'student')

        # 6. Search by name/email
        resp_search = self.client.get('/api/admin/login-history?search=student@gmail.com')
        self.assertEqual(resp_search.status_code, 200)
        data_search = json.loads(resp_search.data)
        self.assertTrue(any(l['userEmail'] == 'student@gmail.com' for l in data_search['logins']))

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

        # Login as teacher/admin
        self.client.post('/api/auth/login', json={
            'email': 'revathi@gmail.com',
            'password': 'Techzen_123'
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
        # Login as admin/faculty Revathi
        login_resp = self.client.post('/api/auth/login', json={
            'email': 'revathi@gmail.com',
            'password': 'Techzen_123'
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

        # 4. Google login with existing seeded admin email
        teacher_google_resp = self.client.post('/api/auth/google', json={
            'credential': 'demo-google-token',
            'demo_email': 'revathi@gmail.com',
            'demo_name': 'Revathi Admin'
        })
        self.assertEqual(teacher_google_resp.status_code, 200)
        t_state = json.loads(teacher_google_resp.data)
        self.assertEqual(t_state['currentUser']['role'], 'admin')

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

    def test_teacher_request_lifecycle(self):
        # 1. Unauthenticated request -> 401
        self.client.post('/api/auth/logout')
        resp = self.client.post('/api/teacher/request')
        self.assertEqual(resp.status_code, 401)

        # 2. Student login
        self.client.post('/api/auth/login', json={
            'email': 'student@gmail.com',
            'password': 'Password123!'
        })

        # 3. Submit request -> 200, status pending
        resp = self.client.post('/api/teacher/request')
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(data['teacher_status'], 'pending')

        # Verify in state
        resp_state = self.client.get('/api/state')
        state_data = json.loads(resp_state.data)
        self.assertEqual(state_data['currentUser']['teacherStatus'], 'pending')

        # 4. Duplicate request while pending -> 400
        resp_dup = self.client.post('/api/teacher/request')
        self.assertEqual(resp_dup.status_code, 400)
        err = json.loads(resp_dup.data)
        self.assertIn('already pending', err['error'].lower())

    def test_admin_teacher_approval_and_rejection(self):
        # 1. Register candidate A (Alice)
        resp_a = self.client.post('/api/auth/register', json={
            'name': 'Alice Candidate',
            'email': 'alice@candidate.edu',
            'password': 'Password123!'
        })
        self.assertEqual(resp_a.status_code, 200)
        alice_id = json.loads(resp_a.data)['currentUser']['id']

        # Alice submits teacher request
        resp = self.client.post('/api/teacher/request')
        self.assertEqual(resp.status_code, 200)

        # 2. Register candidate B (Bob)
        self.client.post('/api/auth/logout')
        resp_b = self.client.post('/api/auth/register', json={
            'name': 'Bob Candidate',
            'email': 'bob@candidate.edu',
            'password': 'Password123!'
        })
        self.assertEqual(resp_b.status_code, 200)
        bob_id = json.loads(resp_b.data)['currentUser']['id']

        # Bob submits teacher request
        resp = self.client.post('/api/teacher/request')
        self.assertEqual(resp.status_code, 200)

        # 3. Bob attempts to access admin endpoint -> 403 Forbidden
        resp_forbidden = self.client.get('/api/admin/teacher-requests')
        self.assertEqual(resp_forbidden.status_code, 403)

        # 4. Login as Admin Revathi
        self.client.post('/api/auth/logout')
        resp_admin = self.client.post('/api/auth/login', json={
            'email': 'revathi@gmail.com',
            'password': 'Techzen_123'
        })
        self.assertEqual(resp_admin.status_code, 200)
        self.assertEqual(json.loads(resp_admin.data)['currentUser']['role'], 'admin')

        # Admin views pending requests
        resp_list = self.client.get('/api/admin/teacher-requests?status=pending')
        self.assertEqual(resp_list.status_code, 200)
        pending_list = json.loads(resp_list.data)['requests']
        pending_ids = [r['id'] for r in pending_list]
        self.assertIn(alice_id, pending_ids)
        self.assertIn(bob_id, pending_ids)

        # 5. Admin approves Alice
        resp_app = self.client.post(f'/api/admin/teacher-requests/{alice_id}/approve')
        self.assertEqual(resp_app.status_code, 200)

        # 6. Admin rejects Bob
        resp_rej = self.client.post(f'/api/admin/teacher-requests/{bob_id}/reject')
        self.assertEqual(resp_rej.status_code, 200)

        # 7. Verify Alice is now TEACHER with approved status
        self.client.post('/api/auth/logout')
        resp_alice_login = self.client.post('/api/auth/login', json={
            'email': 'alice@candidate.edu',
            'password': 'Password123!'
        })
        alice_data = json.loads(resp_alice_login.data)['currentUser']
        self.assertEqual(alice_data['role'], 'teacher')
        self.assertEqual(alice_data['teacherStatus'], 'approved')

        # Alice can now create a classroom
        resp_create = self.client.post('/api/classrooms', json={
            'name': 'Alice Microeconomics',
            'subject': 'Economics'
        })
        self.assertEqual(resp_create.status_code, 200)

        # 8. Verify Bob is still STUDENT with rejected status
        self.client.post('/api/auth/logout')
        resp_bob_login = self.client.post('/api/auth/login', json={
            'email': 'bob@candidate.edu',
            'password': 'Password123!'
        })
        bob_data = json.loads(resp_bob_login.data)['currentUser']
        self.assertEqual(bob_data['role'], 'student')
        self.assertEqual(bob_data['teacherStatus'], 'rejected')

        # Bob cannot create a classroom -> 403
        resp_bob_create = self.client.post('/api/classrooms', json={
            'name': 'Bob Microeconomics',
            'subject': 'Economics'
        })
        self.assertEqual(resp_bob_create.status_code, 403)

        # Bob can re-apply
        resp_reapply = self.client.post('/api/teacher/request')
        self.assertEqual(resp_reapply.status_code, 200)
        self.assertEqual(json.loads(resp_reapply.data)['teacher_status'], 'pending')

    def test_rbac_authorization_matrix(self):
        # 1. Unauthenticated requests -> 401
        self.client.post('/api/auth/logout')
        self.assertEqual(self.client.post('/api/classrooms', json={'name': 'C', 'subject': 'S'}).status_code, 401)
        self.assertEqual(self.client.get('/api/admin/teacher-requests').status_code, 401)
        self.assertEqual(self.client.get('/api/teacher/student-performance').status_code, 401)
        self.assertEqual(self.client.post('/api/ai/generate', json={'topic': 'T'}).status_code, 401)

        # 2. Student role -> 403 on teacher & admin routes
        self.client.post('/api/auth/login', json={'email': 'student@gmail.com', 'password': 'Password123!'})
        self.assertEqual(self.client.post('/api/classrooms', json={'name': 'C', 'subject': 'S'}).status_code, 403)
        self.assertEqual(self.client.get('/api/admin/teacher-requests').status_code, 403)
        self.assertEqual(self.client.get('/api/teacher/student-performance').status_code, 403)
        self.assertEqual(self.client.post('/api/ai/generate', json={'topic': 'T', 'is_notes': False}).status_code, 403)

        # 3. Create approved teacher
        self.client.post('/api/auth/logout')
        reg_t = self.client.post('/api/auth/register', json={'name': 'Teacher Dan', 'email': 'dan@school.edu', 'password': 'Password123!'})
        dan_id = json.loads(reg_t.data)['currentUser']['id']
        self.client.post('/api/teacher/request')

        # Admin approves Dan
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        self.client.post(f'/api/admin/teacher-requests/{dan_id}/approve')

        # Login as Dan (Teacher)
        self.client.post('/api/auth/login', json={'email': 'dan@school.edu', 'password': 'Password123!'})
        # Teacher CAN access teacher endpoints
        self.assertEqual(self.client.post('/api/classrooms', json={'name': 'Dan Chem', 'subject': 'Chemistry'}).status_code, 200)
        self.assertEqual(self.client.get('/api/teacher/student-performance').status_code, 200)
        # Teacher CANNOT access admin endpoints -> 403
        self.assertEqual(self.client.get('/api/admin/teacher-requests').status_code, 403)
        self.assertEqual(self.client.post(f'/api/admin/teacher-requests/{dan_id}/approve').status_code, 403)

        # 4. Admin role -> 200 on both admin and teacher routes
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        self.assertEqual(self.client.get('/api/admin/teacher-requests').status_code, 200)
        self.assertEqual(self.client.post('/api/classrooms', json={'name': 'Admin Class', 'subject': 'Tech'}).status_code, 200)
        self.assertEqual(self.client.get('/api/teacher/student-performance').status_code, 200)

    def test_ownership_security(self):
        # 1. Student A registers and creates a personal deck
        self.client.post('/api/auth/register', json={
            'name': 'User A',
            'email': 'usera@gmail.com',
            'password': 'Password123!'
        })
        resp_deck = self.client.post('/api/decks', json={
            'title': 'User A Secret Deck',
            'subject': 'Biology',
            'cards': [{'question': 'Secret Q', 'answer': 'Secret A'}]
        })
        self.assertEqual(resp_deck.status_code, 200)
        user_a_deck = next((d for d in json.loads(resp_deck.data)['decks'] if d['title'] == 'User A Secret Deck'), None)
        self.assertIsNotNone(user_a_deck)
        deck_id = user_a_deck['id']

        # 2. Student B registers with the same display name 'User A' to attempt impersonation
        self.client.post('/api/auth/logout')
        self.client.post('/api/auth/register', json={
            'name': 'User A',
            'email': 'userb_impersonator@gmail.com',
            'password': 'Password123!'
        })

        # Student B attempts to modify Student A's deck -> 403 Forbidden
        resp_hack_edit = self.client.put(f'/api/decks/{deck_id}', json={
            'title': 'Hacked Title',
            'subject': 'Biology'
        })
        self.assertEqual(resp_hack_edit.status_code, 403)

        # Student B attempts to delete Student A's deck -> 403 Forbidden
        resp_hack_del = self.client.delete(f'/api/decks/{deck_id}')
        self.assertEqual(resp_hack_del.status_code, 403)

        # 3. Classroom ownership verification:
        # Login as Admin Revathi, create classroom
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        resp_cls = self.client.post('/api/classrooms', json={'name': 'Revathi Exclusive', 'subject': 'Math'})
        cls_id = next(c['id'] for c in json.loads(resp_cls.data)['classrooms'] if c['name'] == 'Revathi Exclusive')

        # Dan (another teacher) attempts to delete Revathi's classroom -> 403 Forbidden
        # Create approved teacher Dan
        reg_dan = self.client.post('/api/auth/register', json={'name': 'Dan', 'email': 'dan_prof@gmail.com', 'password': 'Password123!'})
        dan_id = json.loads(reg_dan.data)['currentUser']['id']
        self.client.post('/api/teacher/request')
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        self.client.post(f'/api/admin/teacher-requests/{dan_id}/approve')

        self.client.post('/api/auth/login', json={'email': 'dan_prof@gmail.com', 'password': 'Password123!'})
        resp_del_cls = self.client.delete(f'/api/classrooms/{cls_id}')
        self.assertEqual(resp_del_cls.status_code, 403)

    def test_ai_hint_without_login(self):
        """Verify unauthenticated AI hint request returns 401 Unauthorized."""
        resp = self.client.post('/api/ai/hint', json={'question': 'What is the capital of France?'})
        self.assertEqual(resp.status_code, 401)
        data = json.loads(resp.data)
        self.assertFalse(data['success'])

    def test_ai_hint_valid_flashcard(self):
        """Verify authenticated student can request an AI hint for an enrolled deck card."""
        self.client.post('/api/auth/login', json={'email': 'student@gmail.com', 'password': 'Password123!'})
        state = json.loads(self.client.get('/api/state').data)
        card = state['decks'][0]['cards'][0]

        resp = self.client.post('/api/ai/hint', json={'flashcard_id': card['id']})
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertTrue(data['success'])
        self.assertIn('hint', data['data'])
        self.assertTrue(len(data['data']['hint']) > 5)

    def test_ai_hint_invalid_flashcard(self):
        """Verify requesting hint for non-existent card returns 404."""
        self.client.post('/api/auth/login', json={'email': 'student@gmail.com', 'password': 'Password123!'})
        resp = self.client.post('/api/ai/hint', json={'flashcard_id': 'nonexistent-card-999'})
        self.assertEqual(resp.status_code, 404)
        data = json.loads(resp.data)
        self.assertFalse(data['success'])

    def test_ai_hint_does_not_reveal_answer(self):
        """Verify AI hint does not directly reveal the exact answer."""
        self.client.post('/api/auth/login', json={'email': 'student@gmail.com', 'password': 'Password123!'})
        state = json.loads(self.client.get('/api/state').data)
        card = state['decks'][0]['cards'][0]

        resp = self.client.post('/api/ai/hint', json={'flashcard_id': card['id']})
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        hint = data['data']['hint']
        # The hint should not be identical to the exact answer
        self.assertNotEqual(hint.strip().lower(), card['answer'].strip().lower())

    def test_ai_hint_unauthorized_private_card(self):
        """Verify a student cannot request hints for another student's private deck."""
        # 1. User A creates private deck
        self.client.post('/api/auth/register', json={'name': 'User A', 'email': 'student_a@gmail.com', 'password': 'Password123!'})
        resp_deck = self.client.post('/api/decks', json={
            'title': 'A Private Notes',
            'subject': 'Biology',
            'cards': [{'question': 'Private Biology Q', 'answer': 'Private Biology A'}]
        })
        deck_id = next(d['id'] for d in json.loads(resp_deck.data)['decks'] if d['title'] == 'A Private Notes')
        # Get card id from database
        conn = database.connection.get_db_connection()
        card_row = conn.execute("SELECT id FROM cards WHERE deck_id = ?", (deck_id,)).fetchone()
        conn.close()
        card_id = card_row['id']

        # 2. User B logs in and attempts to access User A's private card
        self.client.post('/api/auth/logout')
        self.client.post('/api/auth/register', json={'name': 'User B', 'email': 'student_b@gmail.com', 'password': 'Password123!'})
        resp = self.client.post('/api/ai/hint', json={'flashcard_id': card_id})
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(json.loads(resp.data)['success'])

    def test_check_answer_without_login(self):
        """Verify unauthenticated answer check returns 401."""
        resp = self.client.post('/api/ai/check-answer', json={'student_answer': 'it pumps blood'})
        self.assertEqual(resp.status_code, 401)

    def test_check_answer_correct(self):
        """Verify evaluation of correct student answer."""
        self.client.post('/api/auth/login', json={'email': 'student@gmail.com', 'password': 'Password123!'})
        resp = self.client.post('/api/ai/check-answer', json={
            'question': 'What is the function of the heart?',
            'correct_answer': 'The heart pumps oxygenated blood throughout the circulatory system.',
            'student_answer': 'The heart pumps blood through the body.'
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['result'], 'CORRECT')
        self.assertIn('feedback', data['data'])

    def test_check_answer_partially_correct(self):
        """Verify evaluation of partially correct student answer."""
        self.client.post('/api/auth/login', json={'email': 'student@gmail.com', 'password': 'Password123!'})
        resp = self.client.post('/api/ai/check-answer', json={
            'question': 'What is the function of the heart?',
            'correct_answer': 'The heart pumps oxygenated blood throughout the circulatory system.',
            'student_answer': 'pumps blood'
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertTrue(data['success'])
        self.assertIn(data['data']['result'], ['PARTIALLY_CORRECT', 'CORRECT'])

    def test_check_answer_incorrect(self):
        """Verify evaluation of incorrect student answer."""
        self.client.post('/api/auth/login', json={'email': 'student@gmail.com', 'password': 'Password123!'})
        resp = self.client.post('/api/ai/check-answer', json={
            'question': 'What is the function of the heart?',
            'correct_answer': 'The heart pumps oxygenated blood throughout the circulatory system.',
            'student_answer': 'It filters toxins like alcohol and urea from digestion.'
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['result'], 'INCORRECT')

    def test_check_answer_unauthorized_private_card(self):
        """Verify student cannot check answer against another student's private card."""
        self.client.post('/api/auth/register', json={'name': 'User A', 'email': 'student_a2@gmail.com', 'password': 'Password123!'})
        resp_deck = self.client.post('/api/decks', json={
            'title': 'A Private Deck',
            'subject': 'History',
            'cards': [{'question': 'Secret Battle', 'answer': '1066 Hastings'}]
        })
        deck_id = next(d['id'] for d in json.loads(resp_deck.data)['decks'] if d['title'] == 'A Private Deck')
        conn = database.connection.get_db_connection()
        card_id = conn.execute("SELECT id FROM cards WHERE deck_id = ?", (deck_id,)).fetchone()['id']
        conn.close()

        self.client.post('/api/auth/logout')
        self.client.post('/api/auth/register', json={'name': 'User B', 'email': 'student_b2@gmail.com', 'password': 'Password123!'})
        resp = self.client.post('/api/ai/check-answer', json={
            'flashcard_id': card_id,
            'student_answer': '1066'
        })
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(json.loads(resp.data)['success'])

    def test_gemini_fallback_and_invalid_response(self):
        """Verify that Gemini API failure or invalid payload produces clean fallbacks without crashing."""
        from services.ai_service import evaluate_student_answer, generate_hint
        with unittest.mock.patch('services.ai_service.call_gemini_api', return_value=(None, 'API_ERROR_500')):
            hint = generate_hint("What is photosynthesis?", "Process of converting light into glucose")
            self.assertTrue(len(hint) > 0)
            self.assertIsInstance(hint, str)

            eval_res = evaluate_student_answer(
                "What is photosynthesis?",
                "Process of converting light into glucose",
                "converting light into glucose"
            )
            self.assertEqual(eval_res['result'], 'CORRECT')

    def test_teacher_upload_pdf(self):
        """Verify faculty can upload PDF documents to generate flashcard decks."""
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        minimal_pdf = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 80 >>
stream
BT
/F1 12 Tf
100 700 Td
(Photosynthesis is defined as the biological process of converting sunlight into glucose.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000374 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
453
%%EOF
"""
        data = {
            'file': (io.BytesIO(minimal_pdf), 'cellular_biology.pdf'),
            'count': '5',
            'level': 'Intermediate Mastery'
        }
        resp = self.client.post('/api/decks/upload', data=data, content_type='multipart/form-data')
        self.assertEqual(resp.status_code, 200)
        res_json = json.loads(resp.data)
        self.assertTrue(res_json['success'])
        self.assertIn('cards', res_json['data'])
        self.assertTrue(len(res_json['data']['cards']) > 0)
        card = res_json['data']['cards'][0]
        self.assertIn('question', card)
        self.assertIn('answer', card)
        self.assertIn('difficulty', card)

    def test_teacher_upload_txt(self):
        """Verify faculty can upload TXT documents to generate flashcard decks."""
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        txt_content = b"Data Structures: An Array is a collection of items stored at contiguous memory locations. A Linked List is a linear data structure where elements are linked using pointers."
        data = {
            'file': (io.BytesIO(txt_content), 'data_structures.txt'),
            'count': '4'
        }
        resp = self.client.post('/api/decks/upload', data=data, content_type='multipart/form-data')
        self.assertEqual(resp.status_code, 200)
        res_json = json.loads(resp.data)
        self.assertTrue(res_json['success'])
        self.assertIn('cards', res_json['data'])
        self.assertTrue(len(res_json['data']['cards']) > 0)

    def test_student_cannot_upload(self):
        """Verify students receive 403 Forbidden when attempting to upload documents."""
        self.client.post('/api/auth/login', json={'email': 'student@gmail.com', 'password': 'Password123!'})
        data = {
            'file': (io.BytesIO(b"Unauthorized student document content."), 'notes.txt')
        }
        resp = self.client.post('/api/decks/upload', data=data, content_type='multipart/form-data')
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(json.loads(resp.data)['success'])

    def test_unauthenticated_upload_rejected(self):
        """Verify unauthenticated document upload returns 401."""
        data = {
            'file': (io.BytesIO(b"Unauthenticated file."), 'notes.txt')
        }
        resp = self.client.post('/api/decks/upload', data=data, content_type='multipart/form-data')
        self.assertEqual(resp.status_code, 401)

    def test_invalid_file_extension_rejected(self):
        """Verify unsupported file types (.exe, .png) are rejected with 400."""
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        data = {
            'file': (io.BytesIO(b"executable content"), 'script.exe')
        }
        resp = self.client.post('/api/decks/upload', data=data, content_type='multipart/form-data')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('Unsupported file format', json.loads(resp.data)['error'])

    def test_large_file_rejected(self):
        """Verify files exceeding 10 MB limit are rejected."""
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        oversized = io.BytesIO(b"A" * (11 * 1024 * 1024))
        data = {
            'file': (oversized, 'huge_file.txt')
        }
        resp = self.client.post('/api/decks/upload', data=data, content_type='multipart/form-data')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('exceeds the maximum allowed limit', json.loads(resp.data)['error'])

    def test_empty_pdf_handled(self):
        """Verify empty PDF or PDF with no readable text returns 400."""
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        import pypdf
        writer = pypdf.PdfWriter()
        writer.add_blank_page(width=100, height=100)
        buf = io.BytesIO()
        writer.write(buf)
        buf.seek(0)

        data = {
            'file': (buf, 'empty.pdf')
        }
        resp = self.client.post('/api/decks/upload', data=data, content_type='multipart/form-data')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('no readable text', json.loads(resp.data)['error'].lower())

    def test_quiz_generation_success(self):
        """Verify generating practice quiz returns questions with 4 options and correct answers."""
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        resp = self.client.post('/api/decks/deck-1/generate-quiz')
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertTrue(data['success'])
        quiz = data['data']['quiz']
        self.assertTrue(len(quiz) > 0)
        for q in quiz:
            self.assertEqual(len(q['options']), 4)
            self.assertIn(q['correct_answer'], q['options'])
            self.assertEqual(q['options'][q['correct_index']], q['correct_answer'])

    def test_quiz_generation_no_duplicate_options(self):
        """Verify duplicate options are strictly prevented across all quiz questions."""
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        resp = self.client.post('/api/decks/deck-1/generate-quiz')
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        quiz = data['data']['quiz']
        for q in quiz:
            lower_options = [opt.strip().lower() for opt in q['options']]
            self.assertEqual(len(set(lower_options)), 4, f"Found duplicate option in question: {q['question']}")

    def test_quiz_empty_deck_rejected(self):
        """Verify generating quiz on a deck with no flashcards returns 400."""
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        conn = database.connection.get_db_connection()
        conn.execute("INSERT INTO decks (id, title, subject, creator_name) VALUES ('empty-deck-test', 'Empty Deck', 'Empty', 'Revathi')")
        conn.commit()
        conn.close()

        resp = self.client.post('/api/decks/empty-deck-test/generate-quiz')
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(json.loads(resp.data)['success'])

    def _create_test_multipage_pdf(self):
        """Helper to create a valid 2-page academic PDF with distinct page texts."""
        import pypdf
        p1 = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 80 >>
stream
BT
/F1 12 Tf
100 700 Td
(Photosynthesis is defined as the biological process of converting sunlight into glucose.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
trailer
<< /Size 6 /Root 1 0 R >>
startxref
453
%%EOF
"""
        p2 = p1.replace(
            b'Photosynthesis is defined as the biological process of converting sunlight into glucose.',
            b'Mitosis is defined as the biological cell division resulting in identical daughter cells.'
        )
        r1 = pypdf.PdfReader(io.BytesIO(p1))
        r2 = pypdf.PdfReader(io.BytesIO(p2))
        writer = pypdf.PdfWriter()
        writer.add_page(r1.pages[0])
        writer.add_page(r2.pages[0])
        buf = io.BytesIO()
        writer.write(buf)
        buf.seek(0)
        return buf

    def test_rag_vector_cosine_similarity(self):
        """Verify vector embedding generation and cosine similarity properties."""
        from services.rag_service import generate_local_embedding, compute_cosine_similarity
        vec_a = generate_local_embedding("cellular biology respiration")
        vec_b = generate_local_embedding("cellular biology respiration")
        vec_c = generate_local_embedding("quantum database relational SQL")

        # Identity self-similarity must be 1.0
        self.assertAlmostEqual(compute_cosine_similarity(vec_a, vec_b), 1.0, places=3)
        # Similar topic must score higher than unrelated topic
        vec_rel = generate_local_embedding("cellular respiration ATP mitochondria")
        sim_rel = compute_cosine_similarity(vec_a, vec_rel)
        sim_unrel = compute_cosine_similarity(vec_a, vec_c)
        self.assertGreater(sim_rel, sim_unrel)

    def test_rag_pdf_indexing_and_chunking(self):
        """Verify page-aware PDF text parsing, chunking, and SQLite storage."""
        from services.rag_service import index_pdf_document, retrieve_relevant_chunks
        pdf_buf = self._create_test_multipage_pdf()
        doc_info, err = index_pdf_document(pdf_buf, "biology_lecture.pdf", "usr-admin-1", classroom_id="cls-1")

        self.assertIsNone(err)
        self.assertIsNotNone(doc_info)
        self.assertEqual(doc_info['total_pages'], 2)
        self.assertGreaterEqual(doc_info['total_chunks'], 2)
        self.assertEqual(doc_info['title'], "Biology Lecture")

        # Verify chunks exist in database
        conn = database.connection.get_db_connection()
        chunks = conn.execute("SELECT * FROM document_chunks WHERE document_id = ? ORDER BY page_number ASC", (doc_info['document_id'],)).fetchall()
        conn.close()

        self.assertGreaterEqual(len(chunks), 2)
        pages_found = {c['page_number'] for c in chunks}
        self.assertIn(1, pages_found)
        self.assertIn(2, pages_found)

        # Retrieval check
        top = retrieve_relevant_chunks(doc_info['document_id'], "What is photosynthesis?", top_k=2)
        self.assertGreater(len(top), 0)
        self.assertEqual(top[0]['page_number'], 1)
        self.assertIn("photosynthesis", top[0]['content'].lower())

    def test_rag_upload_endpoint_success(self):
        """Verify POST /api/documents/upload-rag indexes document and generates flashcards with citations."""
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        pdf_buf = self._create_test_multipage_pdf()
        data = {
            'file': (pdf_buf, 'cell_division.pdf'),
            'count': '4',
            'classroom_id': 'cls-1'
        }
        resp = self.client.post('/api/documents/upload-rag', data=data, content_type='multipart/form-data')
        self.assertEqual(resp.status_code, 200)
        res_json = json.loads(resp.data)
        self.assertTrue(res_json['success'])
        doc_data = res_json['data']
        self.assertIn('document', doc_data)
        self.assertEqual(doc_data['document']['total_pages'], 2)
        self.assertIn('cards', doc_data)
        cards = doc_data['cards']
        self.assertGreater(len(cards), 0)
        for c in cards:
            self.assertIn('question', c)
            self.assertIn('answer', c)
            self.assertIn('page_number', c)
            self.assertIn('source_citation', c)
            self.assertTrue(c['source_citation'].startswith('Page '))

    def test_rag_student_cannot_upload(self):
        """Verify students receive 403 Forbidden when attempting to upload documents for RAG indexing."""
        self.client.post('/api/auth/login', json={'email': 'student@gmail.com', 'password': 'Password123!'})
        pdf_buf = self._create_test_multipage_pdf()
        data = {'file': (pdf_buf, 'student_doc.pdf')}
        resp = self.client.post('/api/documents/upload-rag', data=data, content_type='multipart/form-data')
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(json.loads(resp.data)['success'])

    def test_rag_document_query_endpoint(self):
        """Verify POST /api/documents/<doc_id>/query returns grounded answer and page citations."""
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        pdf_buf = self._create_test_multipage_pdf()
        from services.rag_service import index_pdf_document
        doc_info, _ = index_pdf_document(pdf_buf, "mitosis_study.pdf", "usr-admin-1", classroom_id="cls-1")

        resp = self.client.post(f"/api/documents/{doc_info['document_id']}/query", json={
            'query': 'Explain mitosis and cell division'
        })
        self.assertEqual(resp.status_code, 200)
        res_json = json.loads(resp.data)
        self.assertTrue(res_json['success'])
        qa_data = res_json['data']
        self.assertIn('answer', qa_data)
        self.assertIn('citations', qa_data)
        self.assertGreater(len(qa_data['citations']), 0)
        top_cit = qa_data['citations'][0]
        self.assertEqual(top_cit['page_number'], 2)
        self.assertIn('score', top_cit)

    def test_rag_enrolled_student_can_query(self):
        """Verify students enrolled in the classroom can query documents linked to that classroom."""
        # Index document linked to cls-1 as admin
        pdf_buf = self._create_test_multipage_pdf()
        from services.rag_service import index_pdf_document
        doc_info, _ = index_pdf_document(pdf_buf, "biology_cls1.pdf", "usr-admin-1", classroom_id="cls-1")

        # Login as student (student@gmail.com is enrolled in cls-1)
        self.client.post('/api/auth/login', json={'email': 'student@gmail.com', 'password': 'Password123!'})
        resp = self.client.post(f"/api/documents/{doc_info['document_id']}/query", json={
            'query': 'What is photosynthesis?'
        })
        self.assertEqual(resp.status_code, 200)
        res_json = json.loads(resp.data)
        self.assertTrue(res_json['success'])

    def test_rag_unauthorized_student_cannot_query(self):
        """Verify students not enrolled in the classroom receive 403 Forbidden on document queries."""
        pdf_buf = self._create_test_multipage_pdf()
        from services.rag_service import index_pdf_document
        # Create private document not linked to any classroom
        doc_info, _ = index_pdf_document(pdf_buf, "private_doc.pdf", "usr-admin-1", classroom_id=None)

        # Login as student
        self.client.post('/api/auth/login', json={'email': 'student@gmail.com', 'password': 'Password123!'})
        resp = self.client.post(f"/api/documents/{doc_info['document_id']}/query", json={
            'query': 'What is photosynthesis?'
        })
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(json.loads(resp.data)['success'])

    def test_rag_invalid_pdf_handling(self):
        """Verify invalid or non-pdf files return 400."""
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        data = {'file': (io.BytesIO(b"not a pdf content"), 'test.txt')}
        resp = self.client.post('/api/documents/upload-rag', data=data, content_type='multipart/form-data')
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(json.loads(resp.data)['success'])

    # ==========================================
    # PHASE 3: PLATFORM & ANALYTICS TESTS
    # ==========================================

    def test_teacher_application_created_on_registration(self):
        """Verify teacher application is created in teacher_applications table upon registration."""
        resp = self.client.post('/api/auth/register', json={
            'name': 'Candidate Prof',
            'email': 'prof_cand@school.edu',
            'password': 'Password123!',
            'role': 'teacher'
        })
        self.assertEqual(resp.status_code, 200)
        cand_id = json.loads(resp.data)['currentUser']['id']

        # Check database table teacher_applications
        conn = database.connection.get_db_connection()
        app_row = conn.execute("SELECT * FROM teacher_applications WHERE user_id = ?", (cand_id,)).fetchone()
        conn.close()

        self.assertIsNotNone(app_row)
        self.assertEqual(app_row['status'], 'pending')
        self.assertIsNotNone(app_row['submitted_at'])

    def test_admin_views_teacher_applications(self):
        """Verify admin can view teacher applications."""
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        resp = self.client.get('/api/admin/teacher-applications')
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertIn('applications', data)
        self.assertIsInstance(data['applications'], list)

    def test_student_cannot_view_applications(self):
        """Verify student receives 403 Forbidden when attempting to view teacher applications."""
        self.client.post('/api/auth/login', json={'email': 'student@gmail.com', 'password': 'Password123!'})
        resp = self.client.get('/api/admin/teacher-applications')
        self.assertEqual(resp.status_code, 403)

    def test_teacher_cannot_approve_themselves(self):
        """Verify teacher candidates cannot approve their own application."""
        # Register candidate
        resp = self.client.post('/api/auth/register', json={
            'name': 'Self Approver',
            'email': 'self_approver@school.edu',
            'password': 'Password123!',
            'role': 'teacher'
        })
        user_id = json.loads(resp.data)['currentUser']['id']

        # Candidate is logged in as student; attempt to approve -> 403 Forbidden
        resp_appr = self.client.post(f'/api/admin/teacher-applications/{user_id}/approve')
        self.assertEqual(resp_appr.status_code, 403)

    def test_admin_approves_teacher_workflow(self):
        """Verify admin approval updates teacher_applications table and promotes user to teacher."""
        # 1. Register candidate
        self.client.post('/api/auth/register', json={
            'name': 'Future Faculty',
            'email': 'faculty_approved@school.edu',
            'password': 'Password123!',
            'role': 'teacher'
        })
        cand_id = json.loads(self.client.get('/api/state').data)['currentUser']['id']

        # 2. Login as admin
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        resp = self.client.post(f'/api/admin/teacher-applications/{cand_id}/approve')
        self.assertEqual(resp.status_code, 200)

        # 3. Check DB records
        conn = database.connection.get_db_connection()
        user_row = conn.execute("SELECT role, teacher_status FROM users WHERE id = ?", (cand_id,)).fetchone()
        app_row = conn.execute("SELECT status, reviewed_at, reviewed_by FROM teacher_applications WHERE user_id = ?", (cand_id,)).fetchone()
        conn.close()

        self.assertEqual(user_row['role'], 'teacher')
        self.assertEqual(user_row['teacher_status'], 'approved')
        self.assertEqual(app_row['status'], 'approved')
        self.assertIsNotNone(app_row['reviewed_at'])

    def test_approved_teacher_has_faculty_access(self):
        """Verify approved teacher can create classrooms."""
        # Create and approve teacher
        reg = self.client.post('/api/auth/register', json={
            'name': 'Dr Chemistry',
            'email': 'dr_chem@school.edu',
            'password': 'Password123!',
            'role': 'teacher'
        })
        t_id = json.loads(reg.data)['currentUser']['id']
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        self.client.post(f'/api/admin/teacher-applications/{t_id}/approve')

        # Login as Dr Chemistry
        self.client.post('/api/auth/login', json={'email': 'dr_chem@school.edu', 'password': 'Password123!'})
        resp = self.client.post('/api/classrooms', json={
            'name': 'Organic Chemistry I',
            'subject': 'Chemistry'
        })
        self.assertEqual(resp.status_code, 200)

    def test_rejected_teacher_denied_access(self):
        """Verify rejected teacher candidate is denied classroom creation."""
        reg = self.client.post('/api/auth/register', json={
            'name': 'Rejected Candidate',
            'email': 'rejected_prof@school.edu',
            'password': 'Password123!',
            'role': 'teacher'
        })
        cand_id = json.loads(reg.data)['currentUser']['id']
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        self.client.post(f'/api/admin/teacher-applications/{cand_id}/reject')

        # Login as candidate -> still student with rejected status
        self.client.post('/api/auth/login', json={'email': 'rejected_prof@school.edu', 'password': 'Password123!'})
        resp = self.client.post('/api/classrooms', json={'name': 'Illegal Class', 'subject': 'Tech'})
        self.assertEqual(resp.status_code, 403)

    def test_student_progress_tracking_upsert(self):
        """Verify POST /api/study/result upserts student_progress table."""
        self.client.post('/api/auth/login', json={'email': 'student@gmail.com', 'password': 'Password123!'})
        # Study card known
        resp1 = self.client.post('/api/study/result', json={'card_id': 'card-1-1', 'result': 'known'})
        self.assertEqual(resp1.status_code, 200)

        conn = database.connection.get_db_connection()
        p1 = conn.execute("SELECT * FROM student_progress WHERE student_id = 'usr-student-1' AND flashcard_id = 'card-1-1'").fetchone()
        conn.close()
        self.assertIsNotNone(p1)
        self.assertGreaterEqual(p1['attempts'], 1)
        self.assertGreaterEqual(p1['correct_count'], 1)

        # Study card review
        resp2 = self.client.post('/api/study/result', json={'card_id': 'card-1-1', 'result': 'review'})
        self.assertEqual(resp2.status_code, 200)

        conn = database.connection.get_db_connection()
        p2 = conn.execute("SELECT * FROM student_progress WHERE student_id = 'usr-student-1' AND flashcard_id = 'card-1-1'").fetchone()
        conn.close()
        self.assertGreater(p2['attempts'], p1['attempts'])
        self.assertGreaterEqual(p2['incorrect_count'], 1)

    def test_classroom_diagnosis_aggregation_and_privacy(self):
        """Verify GET /api/classrooms/<id>/diagnosis aggregates topic metrics and respects privacy."""
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        resp = self.client.get('/api/classrooms/cls-1/diagnosis')
        self.assertEqual(resp.status_code, 200)
        res_json = json.loads(resp.data)
        self.assertTrue(res_json['success'])
        data = res_json['data']

        self.assertEqual(data['classroom_id'], 'cls-1')
        self.assertIn('average_performance', data)
        self.assertIn('strong_topics', data)
        self.assertIn('needs_improvement', data)
        self.assertIn('ai_diagnosis', data)

        ai_diag = data['ai_diagnosis']
        self.assertIn('diagnosis', ai_diag)
        self.assertIn('recommendation', ai_diag)
        self.assertIn('action_steps', ai_diag)

        # Privacy Check: No student names, emails, or student IDs in the diagnosis text
        diag_str = (ai_diag['diagnosis'] + " " + ai_diag['recommendation']).lower()
        self.assertNotIn('eleanor', diag_str)
        self.assertNotIn('marcus', diag_str)
        self.assertNotIn('student@gmail.com', diag_str)
        self.assertNotIn('usr-student-1', diag_str)

    def test_student_cannot_access_classroom_diagnosis(self):
        """Verify students receive 403 Forbidden when attempting to view classroom performance diagnosis."""
        self.client.post('/api/auth/login', json={'email': 'student@gmail.com', 'password': 'Password123!'})
        resp = self.client.get('/api/classrooms/cls-1/diagnosis')
        self.assertEqual(resp.status_code, 403)

    def test_approved_teacher_can_access_classroom_diagnosis(self):
        """Verify approved teachers (even if not creator of classroom) can access classroom diagnosis."""
        # 1. Register teacher candidate
        reg = self.client.post('/api/auth/register', json={
            'name': 'Prof Biology',
            'email': 'prof_bio@school.edu',
            'password': 'Password123!',
            'role': 'teacher'
        })
        t_id = json.loads(reg.data)['currentUser']['id']

        # 2. Admin approves application
        self.client.post('/api/auth/login', json={'email': 'revathi@gmail.com', 'password': 'Techzen_123'})
        self.client.post(f'/api/admin/teacher-applications/{t_id}/approve')

        # 3. Login as Prof Biology (not creator of cls-1)
        self.client.post('/api/auth/login', json={'email': 'prof_bio@school.edu', 'password': 'Password123!'})
        resp = self.client.get('/api/classrooms/cls-1/diagnosis')
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertTrue(data['success'])
        self.assertIn('ai_diagnosis', data['data'])

if __name__ == '__main__':
    unittest.main()



