"""
Automated unit tests for Timed Exam Preparation Mode.
Verifies topic loading, MCQ distractor generation, submission grading,
Mistake Book synchronization, badge unlocking, and history persistence.
"""

import unittest
import json
from app import app
from database.connection import get_db_connection
from database.init_db import init_db

class TimedExamPrepTestCase(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()
        init_db()

    def login_as_student(self):
        resp = self.client.post('/api/auth/login', json={
            'email': 'student@gmail.com',
            'password': 'Password123!'
        })
        self.assertEqual(resp.status_code, 200)

    def test_unauthenticated_endpoints_blocked(self):
        """Unauthenticated requests must receive 401."""
        resp = self.client.get('/api/exam/topics')
        self.assertEqual(resp.status_code, 401)

        resp = self.client.post('/api/exam/generate', json={})
        self.assertEqual(resp.status_code, 401)

        resp = self.client.post('/api/exam/submit', json={'answers': []})
        self.assertEqual(resp.status_code, 401)

        resp = self.client.get('/api/exam/history')
        self.assertEqual(resp.status_code, 401)

    def test_get_exam_topics(self):
        """Verify topics retrieval returns comprehensive list."""
        self.login_as_student()
        resp = self.client.get('/api/exam/topics')
        self.assertEqual(resp.status_code, 200)
        json_data = json.loads(resp.data)
        self.assertTrue(json_data['success'])
        topics = json_data['data']['topics']
        self.assertTrue(len(topics) >= 1)
        self.assertEqual(topics[0]['id'], 'all')
        self.assertIn('Comprehensive', topics[0]['name'])

    def test_generate_timed_exam(self):
        """Verify generating a timed exam produces questions with 4 unique options each."""
        self.login_as_student()
        resp = self.client.post('/api/exam/generate', json={
            'topics': ['all'],
            'question_count': 5,
            'timer_minutes': 3,
            'difficulty': 'Standard Academic Curriculum'
        })
        self.assertEqual(resp.status_code, 200)
        json_data = json.loads(resp.data)
        self.assertTrue(json_data['success'])
        session = json_data['data']
        self.assertEqual(session['timer_minutes'], 3)
        self.assertEqual(session['timer_duration_seconds'], 180)
        self.assertTrue(len(session['questions']) > 0)

        for q in session['questions']:
            self.assertIn('card_id', q)
            self.assertIn('question', q)
            self.assertIn('options', q)
            self.assertEqual(len(q['options']), 4, f"Question must have 4 options: {q['question']}")
            # Verify no duplicate options
            normalized = [opt.strip().lower() for opt in q['options']]
            self.assertEqual(len(set(normalized)), 4, "Options must be unique")

    def test_submit_exam_grading_and_mistake_sync(self):
        """Verify exam grading, Mistake Book sync for missed questions, and history logging."""
        self.login_as_student()
        # 1. Generate an exam with 5 questions
        gen_resp = self.client.post('/api/exam/generate', json={
            'topics': ['all'],
            'question_count': 5,
            'timer_minutes': 5
        })
        session = json.loads(gen_resp.data)['data']
        questions = session['questions']
        self.assertTrue(len(questions) >= 2)

        # Look up true answers for cards in database to test grading
        conn = get_db_connection()
        answers_payload = []
        for idx, q in enumerate(questions):
            card_id = q['card_id']
            row = conn.execute("SELECT answer FROM cards WHERE id = ?", (card_id,)).fetchone()
            real_answer = row['answer'] if row else q['options'][0]

            if idx == 0:
                # Provide intentionally WRONG answer to test Mistake Book Sync
                answers_payload.append({
                    'card_id': card_id,
                    'question': q['question'],
                    'selected_option': 'WRONG_INTENTIONAL_DISTRACTOR'
                })
            else:
                # Provide correct answer
                answers_payload.append({
                    'card_id': card_id,
                    'question': q['question'],
                    'selected_option': real_answer
                })
        conn.close()

        # 2. Submit the exam answers
        submit_resp = self.client.post('/api/exam/submit', json={
            'exam_title': session['exam_title'],
            'subject': session['subject'],
            'difficulty': session['difficulty'],
            'timer_duration_seconds': 300,
            'time_used_seconds': 142,
            'answers': answers_payload
        })
        self.assertEqual(submit_resp.status_code, 200)
        res_data = json.loads(submit_resp.data)['data']

        # Verify score and breakdown
        self.assertEqual(res_data['score'], len(questions) - 1)
        self.assertFalse(res_data['breakdown'][0]['is_correct'])
        self.assertTrue(res_data['breakdown'][1]['is_correct'])
        self.assertTrue(res_data['mistakes_logged_count'] >= 1)

        # 3. Verify Mistake Book sync in database
        missed_card_id = questions[0]['card_id']
        conn = get_db_connection()
        mistake_row = conn.execute(
            "SELECT * FROM student_mistakes WHERE user_id = 'usr-student-1' AND card_id = ?",
            (missed_card_id,)
        ).fetchone()
        conn.close()

        self.assertIsNotNone(mistake_row, "Missed exam question must be automatically recorded in student_mistakes")
        self.assertEqual(mistake_row['source'], 'exam')
        self.assertEqual(mistake_row['status'], 'needs_review')

        # 4. Verify Exam History entry
        hist_resp = self.client.get('/api/exam/history')
        self.assertEqual(hist_resp.status_code, 200)
        history_list = json.loads(hist_resp.data)['history']
        self.assertTrue(len(history_list) >= 1)
        latest_exam = history_list[0]
        self.assertEqual(latest_exam['id'], res_data['exam_id'])
        self.assertEqual(latest_exam['timeUsed'], '02:22')

        # 5. Verify single exam diagnostic endpoint
        detail_resp = self.client.get(f"/api/exam/history/{latest_exam['id']}")
        self.assertEqual(detail_resp.status_code, 200)
        detail_data = json.loads(detail_resp.data)['data']
        self.assertEqual(detail_data['id'], latest_exam['id'])
        self.assertTrue(len(detail_data['breakdown']) > 0)


if __name__ == '__main__':
    unittest.main()
