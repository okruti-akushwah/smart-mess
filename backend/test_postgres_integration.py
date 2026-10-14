"""Opt-in PostgreSQL migrations and a real owner/customer payment journey."""
from test_app import app  # Establish safe default SQLite configuration before app imports.
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from app.database import get_db
from app import migrate
from postgres_test_support import postgres_database


class PostgresIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.fixture = postgres_database()
        self.engine = self.fixture.__enter__()
        self.addCleanup(self.fixture.__exit__, None, None, None)

    def test_concurrent_migrations_and_repeat_are_safe(self):
        with ThreadPoolExecutor(max_workers=3) as workers:
            results = list(workers.map(lambda _: migrate.upgrade(self.engine), range(3)))
        self.assertEqual(sum(bool(result) for result in results), 1)
        migrate.require_current_schema(self.engine)
        self.assertEqual(migrate.upgrade(self.engine), [])

    def test_failed_migration_is_transactional(self):
        def fail(connection):
            migrate.baseline(connection)
            raise RuntimeError('injected failure')
        with patch.dict(migrate.OPERATIONS, {'0001_baseline': fail}):
            with self.assertRaisesRegex(RuntimeError, 'injected failure'):
                migrate.upgrade(self.engine)
        self.assertEqual(inspect(self.engine).get_table_names(), [])

    def test_api_startup_membership_payment_and_tenancy(self):
        migrate.upgrade(self.engine)
        def database():
            with Session(self.engine) as db:
                yield db
        app.dependency_overrides[get_db] = database
        self.addCleanup(app.dependency_overrides.clear)
        with patch('app.main.engine', self.engine), TestClient(app) as client:
            owners = []
            for phone in ('9234900001', '9234900002'):
                response = client.post('/auth/signup', json={'name': 'Test Owner', 'mess_name': 'Test Kitchen',
                    'phone': phone, 'password': 'test1234', 'role': 'owner'})
                self.assertEqual(response.status_code, 200, response.text)
                login = client.post('/auth/login', json={'phone': phone, 'password': 'test1234'})
                self.assertEqual(login.status_code, 200, login.text)
                owners.append({'Authorization': 'Bearer ' + login.json()['access_token']})
            token = client.get('/owner/join-link', headers=owners[0]).json()['token']
            response = client.post('/join/' + token, json={'name': 'Test Customer', 'phone': '9234900003', 'password': 'test1234'})
            self.assertEqual(response.status_code, 201, response.text)
            request = client.get('/owner/join-requests', headers=owners[0]).json()[0]
            self.assertEqual(client.patch('/owner/join-requests/' + str(request['id']), headers=owners[0], json={'status': 'approved'}).status_code, 200)
            customer_id = client.get('/owner/customers', headers=owners[0]).json()[0]['id']
            response = client.post('/owner/plans', headers=owners[0], json={'user_id': customer_id,
                'price': 700, 'meal_price': 50, 'start_date': date.today().isoformat(),
                'end_date': (date.today() + timedelta(days=6)).isoformat()})
            self.assertEqual(response.status_code, 201, response.text)
            plan_id = response.json()['id']
            response = client.post('/owner/payments', headers=owners[0], json={'plan_id': plan_id,
                'amount': '700.00', 'receipt_key': str(uuid4()), 'reference': 'Isolated PostgreSQL test'})
            self.assertEqual(response.status_code, 201, response.text)
            login = client.post('/auth/login', json={'phone': '9234900003', 'password': 'test1234'})
            customer = {'Authorization': 'Bearer ' + login.json()['access_token']}
            bill = client.get('/bills/current', headers=customer)
            self.assertEqual(bill.status_code, 200, bill.text)
            self.assertEqual(bill.json()['balance_due'], 0)
            self.assertEqual(client.get('/owner/customers', headers=owners[1]).json(), [])
            with self.engine.connect() as connection:
                self.assertEqual(connection.execute(text('SELECT amount FROM payment_records')).scalar(), Decimal('700.00'))

    def test_unversioned_records_are_preserved(self):
        from app.models import Base
        Base.metadata.create_all(self.engine)
        with self.engine.begin() as connection:
            connection.execute(text("INSERT INTO users(id,name,phone,password_hash,role) VALUES(7,'Owner','9234900001','unchanged-owner-hash','owner'),(8,'Customer','9234900003','unchanged-customer-hash','customer')"))
            connection.execute(text("INSERT INTO meal_plans(id,user_id,plan_type,price,start_date,end_date,status) VALUES(10,8,'Legacy',700,'2026-10-01','2026-10-31','active')"))
            connection.execute(text("INSERT INTO payment_records(id,plan_id,amount,reference,receipt_key) VALUES(11,10,200,'Old receipt','preserved-receipt')"))
            users_before = connection.execute(text('SELECT id,name,phone,password_hash,role FROM users ORDER BY id')).all()
            receipt_before = connection.execute(text('SELECT id,plan_id,amount,reference,receipt_key FROM payment_records')).all()
        with self.assertRaisesRegex(RuntimeError, 'Unversioned database'):
            migrate.upgrade(self.engine)
        migrate.upgrade(self.engine, allow_legacy_upgrade=True)
        with self.engine.connect() as connection:
            self.assertEqual(connection.execute(text('SELECT id,name,phone,password_hash,role FROM users ORDER BY id')).all(), users_before)
            self.assertEqual(connection.execute(text('SELECT id,plan_id,amount,reference,receipt_key FROM payment_records')).all(), receipt_before)
            self.assertEqual(connection.execute(text('SELECT price,owner_id,skip_count FROM meal_plans')).one(), (Decimal('700.00'),7,0))
        self.assertEqual(migrate.upgrade(self.engine), [])


if __name__ == '__main__':
    unittest.main()
