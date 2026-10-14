"""Database invariants and the SQLite lock behavior used by action routes."""
import os
os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['APP_ENV'] = 'test'
os.environ['SECRET_KEY'] = 'isolated-concurrency-test-secret'
os.environ['RENDER'] = 'false'

from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Event
import unittest

from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app import models, migrate
from app.database import configure_sqlite_foreign_keys
from app.subscription_extensions import lock_customer


class ConcurrencyInvariantTests(unittest.TestCase):
    def test_upgrade_adds_required_unique_indexes(self):
        engine = create_engine('sqlite://')
        self.addCleanup(engine.dispose)
        migrate.upgrade(engine)
        indexes = {table: {item['name'] for item in inspect(engine).get_indexes(table)}
                   for table in ('meals', 'meal_orders', 'feedback', 'delivery_updates', 'payment_submissions')}
        self.assertIn('uq_meals_owner_date_type', indexes['meals'])
        self.assertIn('uq_meal_orders_user_meal', indexes['meal_orders'])
        self.assertIn('uq_feedback_user_meal', indexes['feedback'])
        self.assertIn('uq_delivery_updates_user_meal', indexes['delivery_updates'])
        self.assertIn('uq_payment_submissions_pending_bill', indexes['payment_submissions'])
        migrate.require_current_schema(engine)

    def test_migration_refuses_duplicate_meals_without_stamping(self):
        engine = create_engine('sqlite://')
        self.addCleanup(engine.dispose)
        models.Base.metadata.create_all(engine)
        with engine.begin() as connection:
            connection.exec_driver_sql('DROP INDEX uq_meals_owner_date_type')
        Session = sessionmaker(bind=engine)
        with Session.begin() as db:
            owner = models.User(name='Owner', phone='9876543210', password_hash='x', role='owner')
            db.add(owner)
            db.flush()
            for description in ('First menu', 'Duplicate menu'):
                db.add(models.Meal(owner_id=owner.id, date=date(2030, 1, 1),
                                   meal_type='lunch', menu_description=description))
        with self.assertRaisesRegex(RuntimeError, 'Duplicate records prevent concurrency constraints'):
            migrate.upgrade(engine, allow_legacy_upgrade=True)
        self.assertNotIn(migrate.VERSION_TABLE.name, inspect(engine).get_table_names())

    def test_pending_submission_constraint_frees_slot_after_review(self):
        engine = create_engine('sqlite://')
        configure_sqlite_foreign_keys(engine)
        self.addCleanup(engine.dispose)
        migrate.upgrade(engine)
        Session = sessionmaker(bind=engine)
        with Session.begin() as db:
            owner = models.User(name='Owner', phone='9876543210', password_hash='x', role='owner')
            customer = models.User(name='Customer', phone='9876543211', password_hash='x', role='customer')
            db.add_all((owner, customer))
            db.flush()
            plan = models.MealPlan(owner_id=owner.id, user_id=customer.id, plan_type='Monthly', price=100,
                                   start_date=date(2030, 1, 1), end_date=date(2030, 1, 31), status='active')
            db.add(plan)
            db.flush()
            bill = models.IssuedBill(owner_id=owner.id, user_id=customer.id, plan_id=plan.id,
                                     base_amount=100, deductions=0, extras_total=0, final_amount=100)
            db.add(bill)
            db.flush()
            first = models.PaymentSubmission(owner_id=owner.id, user_id=customer.id, bill_id=bill.id,
                                             amount=50, method='upi', status='pending')
            db.add(first)
            db.flush()
            first_id, bill_id, owner_id, customer_id = first.id, bill.id, owner.id, customer.id
        with Session.begin() as db:
            db.add(models.PaymentSubmission(owner_id=owner_id, user_id=customer_id, bill_id=bill_id,
                                            amount=50, method='upi', status='pending'))
            with self.assertRaises(IntegrityError):
                db.flush()
        with Session.begin() as db:
            db.get(models.PaymentSubmission, first_id).status = 'rejected'
        with Session.begin() as db:
            db.add(models.PaymentSubmission(owner_id=owner_id, user_id=customer_id, bill_id=bill_id,
                                            amount=50, method='upi', status='pending'))

    def test_sqlite_foreign_keys_reject_invalid_references(self):
        engine = create_engine('sqlite://')
        configure_sqlite_foreign_keys(engine)
        self.addCleanup(engine.dispose)
        migrate.upgrade(engine)
        with engine.connect() as connection:
            self.assertEqual(connection.exec_driver_sql('PRAGMA foreign_keys').scalar(), 1)
        Session = sessionmaker(bind=engine)
        with self.assertRaises(IntegrityError):
            with Session.begin() as db:
                db.add(models.Meal(owner_id=999, date=date(2030, 1, 1), meal_type='lunch', menu_description='Invalid owner'))
                db.flush()

    def test_sqlite_customer_lock_serializes_independent_sessions(self):
        with TemporaryDirectory(prefix='mess-lock-test-') as folder:
            engine = create_engine(f"sqlite:///{Path(folder) / 'locks.db'}",
                                   connect_args={'timeout': 10, 'check_same_thread': False})
            configure_sqlite_foreign_keys(engine)
            try:
                migrate.upgrade(engine)
                Session = sessionmaker(bind=engine)
                with Session.begin() as db:
                    user = models.User(name='Customer', phone='9876543211', password_hash='x', role='customer')
                    db.add(user)
                    db.flush()
                    user_id = user.id

                first_locked, release_first = Event(), Event()
                second_started, second_locked = Event(), Event()

                def first_request():
                    with Session() as db:
                        lock_customer(db, user_id)
                        first_locked.set()
                        release_first.wait(5)
                        db.commit()

                def second_request():
                    first_locked.wait(5)
                    second_started.set()
                    with Session() as db:
                        lock_customer(db, user_id)
                        second_locked.set()
                        db.commit()

                with ThreadPoolExecutor(max_workers=2) as workers:
                    first = workers.submit(first_request)
                    second = workers.submit(second_request)
                    try:
                        self.assertTrue(first_locked.wait(3))
                        self.assertTrue(second_started.wait(3))
                        self.assertFalse(second_locked.wait(0.2))
                    finally:
                        release_first.set()
                    first.result(timeout=5)
                    second.result(timeout=5)
                self.assertTrue(second_locked.is_set())
            finally:
                engine.dispose()


if __name__ == '__main__':
    unittest.main()
