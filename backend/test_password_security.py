"""Password policy and shared throttling regressions using isolated databases."""
from datetime import datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import patch
import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from test_app import ApplicationTests
from app import auth, auth_attempts, models


class PasswordSecurityTests(ApplicationTests):
    def token(self):
        return self.client.get('/owner/join-link', headers=self.owner).json()['token']

    def test_new_accounts_require_eight_characters_on_every_path(self):
        token = self.token()
        for password in ('x', '1234567'):
            owner = {'name': 'New Owner', 'mess_name': 'New Kitchen', 'phone': '9999999901',
                     'role': 'owner', 'password': password}
            customer = {'name': 'New Customer', 'phone': '9999999902', 'password': password}
            self.assertEqual(self.client.post('/auth/signup', json=owner).status_code, 422)
            self.assertEqual(self.client.post('/owner/customers', headers=self.owner, json=customer).status_code, 422)
            self.assertEqual(self.client.post('/join/' + token, json=customer).status_code, 422)
        customer['password'] = '12345678'
        self.assertEqual(self.client.post('/join/' + token, json=customer).status_code, 201)

    def test_unicode_passwords_keep_bcrypt_byte_limit(self):
        body = {'name': 'Customer', 'phone': '9999999902', 'password': 'अ' * 25}
        self.assertEqual(self.client.post('/owner/customers', headers=self.owner, json=body).status_code, 422)
        self.assertEqual(self.client.post('/join/' + self.token(), json=body).status_code, 422)
        body['password'] = 'अ' * 8
        self.assertEqual(self.client.post('/join/' + self.token(), json=body).status_code, 201)

    def test_legacy_short_password_still_logs_in_and_rejoins(self):
        with self.Session() as db:
            user = db.get(models.User, self.customer_id)
            user.password_hash = auth.hash_password('old')
            db.commit()
        self.assertEqual(self.client.post('/auth/login', json={'phone': '9876543211', 'password': 'old'}).status_code, 200)
        self.assertEqual(self.client.post('/auth/token', data={'username': '9876543211', 'password': 'old'}).status_code, 200)
        self.assertEqual(self.client.post('/join/' + self.token(), json={
            'name': 'Customer', 'phone': '9876543211', 'password': 'old'}).status_code, 201)

    def test_json_oauth_and_join_share_one_account_limit(self):
        token = self.token()
        with patch('app.auth.verify_password', return_value=False):
            for attempt in range(auth_attempts.ACCOUNT_LIMIT):
                if attempt % 3 == 0:
                    response = self.client.post('/auth/login', json={'phone': '9876543211', 'password': 'wrong'})
                elif attempt % 3 == 1:
                    response = self.client.post('/auth/token', data={'username': '9876543211', 'password': 'wrong'})
                else:
                    response = self.client.post('/join/' + token, json={'name': 'Customer', 'phone': '9876543211', 'password': 'wrong'})
                self.assertIn(response.status_code, (401, 409))
            for endpoint, body in [('/auth/login', {'phone': '9876543211', 'password': 'test1234'}),
                                   ('/join/' + token, {'name': 'Customer', 'phone': '9876543211', 'password': 'test1234'})]:
                response = self.client.post(endpoint, json=body)
                self.assertEqual(response.status_code, 429)
                self.assertGreater(int(response.headers['Retry-After']), 0)
        self.assertEqual(self.client.post('/auth/login', json={'phone': '9876543210', 'password': 'test1234'}).status_code, 200)

    def test_success_clears_account_failures_and_expiry_restores_access(self):
        with patch('app.auth.verify_password', return_value=False):
            for _ in range(3):
                self.client.post('/auth/login', json={'phone': '9876543211', 'password': 'wrong'})
        self.assertEqual(self.client.post('/auth/login', json={'phone': '9876543211', 'password': 'test1234'}).status_code, 200)
        with self.Session() as db:
            key = auth_attempts.bucket_key('account', '9876543211')
            row = db.get(models.AuthAttemptBucket, key)
            self.assertEqual(row.attempts, 0)
            row.attempts = auth_attempts.ACCOUNT_LIMIT
            db.commit()
        self.assertEqual(self.client.post('/auth/login', json={'phone': '9876543211', 'password': 'test1234'}).status_code, 429)
        with self.Session() as db:
            db.get(models.AuthAttemptBucket, key).window_start = datetime.utcnow() - timedelta(seconds=901)
            db.commit()
        self.assertEqual(self.client.post('/auth/login', json={'phone': '9876543211', 'password': 'test1234'}).status_code, 200)

    def test_ip_limit_cannot_be_bypassed_by_forwarded_header(self):
        with self.Session() as db:
            row = db.get(models.AuthAttemptBucket, auth_attempts.bucket_key('ip', 'testclient'))
            row.attempts = auth_attempts.IP_LIMIT
            db.commit()
        response = self.client.post('/auth/login', headers={'X-Forwarded-For': '203.0.113.1'},
                                    json={'phone': '9876543211', 'password': 'test1234'})
        self.assertEqual(response.status_code, 429)

    def test_missing_and_existing_accounts_have_same_login_error(self):
        with patch('app.auth.verify_password', return_value=False) as verify:
            existing = self.client.post('/auth/login', json={'phone': '9876543211', 'password': 'wrong'})
            missing = self.client.post('/auth/login', json={'phone': '9999999999', 'password': 'wrong'})
            self.assertEqual(existing.status_code, 401)
            self.assertEqual(missing.status_code, 401)
            self.assertEqual(existing.json(), missing.json())
            self.assertEqual(verify.call_count, 2)
            join = self.client.post('/join/' + self.token(), json={
                'name': 'Customer', 'phone': '9876543211', 'password': 'wrong'})
            self.assertEqual(join.status_code, 409)
            self.assertEqual(join.json(), existing.json())


class SharedAttemptTests(unittest.TestCase):
    def test_independent_sessions_enforce_limit_under_concurrency(self):
        with TemporaryDirectory() as folder:
            engine = create_engine('sqlite:///' + (Path(folder) / 'attempts.db').as_posix(),
                                   connect_args={'timeout': 20})
            models.AuthAttemptBucket.__table__.create(engine)
            sessions = sessionmaker(bind=engine)
            request = SimpleNamespace(client=SimpleNamespace(host='203.0.113.10'))
            def attempt(_):
                with sessions() as db:
                    try:
                        auth_attempts.reserve(db, request, '9999999999')
                        return 200
                    except HTTPException as error:
                        return error.status_code
            try:
                with ThreadPoolExecutor(max_workers=4) as workers:
                    results = list(workers.map(attempt, range(16)))
                self.assertEqual(results.count(200), auth_attempts.ACCOUNT_LIMIT)
                self.assertEqual(results.count(429), 6)
                with sessions() as db:
                    self.assertEqual(db.query(models.AuthAttemptBucket).count(), 2)
                with sessions() as db:
                    with self.assertRaises(HTTPException) as blocked:
                        auth_attempts.reserve(db, request, '9999999999')
                    self.assertEqual(blocked.exception.status_code, 429)
            finally:
                engine.dispose()


if __name__ == '__main__':
    unittest.main()
