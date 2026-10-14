"""Versioned migration safety, preservation and import regression tests."""
import os
os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['APP_ENV'] = 'test'
os.environ['SECRET_KEY'] = 'isolated-migration-test-secret'
os.environ['RENDER'] = 'false'

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from sqlalchemy import create_engine, inspect, text
from app import models
from app import migrate, migrations
from postgres_test_support import test_database_url


class MigrationRunnerTests(unittest.TestCase):
    def test_business_details_upgrade_preserves_existing_profile(self):
        migrate.upgrade(self.engine)
        from app.routes.profile_routes import BUSINESS_FIELDS
        with self.engine.begin() as connection:
            connection.execute(text("INSERT INTO users (id,name,phone,password_hash,role) VALUES (1,'Owner','9876543200','preserved','owner')"))
            connection.execute(text("INSERT INTO mess_profiles (owner_id,name,address) VALUES (1,'Existing kitchen','Existing address')"))
            for field in BUSINESS_FIELDS:
                connection.execute(text(f'ALTER TABLE mess_profiles DROP COLUMN {field}'))
            connection.execute(text("DELETE FROM app_schema_revisions WHERE revision='0006_business_details'"))
        self.assertEqual(migrate.upgrade(self.engine), ['0006_business_details'])
        migrate.require_current_schema(self.engine)
        with self.engine.connect() as connection:
            row = connection.execute(text('SELECT name,address,fssai_number FROM mess_profiles')).one()
            self.assertEqual(row, ('Existing kitchen', 'Existing address', ''))

    def setUp(self):
        self.engine = create_engine('sqlite://')
        self.addCleanup(self.engine.dispose)

    def test_fresh_database_and_repeat_are_versioned(self):
        self.assertEqual(migrate.status(self.engine)['pending'], list(migrate.REVISIONS))
        self.assertNotIn(migrate.VERSION_TABLE.name, inspect(self.engine).get_table_names())
        self.assertEqual(migrate.upgrade(self.engine), list(migrate.REVISIONS))
        with patch.dict(migrate.OPERATIONS, {'0001_baseline': lambda _: self.fail('Backfill was repeated')}):
            self.assertEqual(migrate.upgrade(self.engine), [])
        migrate.require_current_schema(self.engine)

    def test_unversioned_schema_requires_explicit_adoption(self):
        models.Base.metadata.create_all(self.engine)
        with self.assertRaisesRegex(RuntimeError, 'Unversioned database'):
            migrate.upgrade(self.engine)
        self.assertNotIn(migrate.VERSION_TABLE.name, inspect(self.engine).get_table_names())
        self.assertEqual(migrate.upgrade(self.engine, allow_legacy_upgrade=True), list(migrate.REVISIONS))

    def test_multi_mess_migration_preserves_existing_memberships_and_allows_another(self):
        from app.database import configure_sqlite_foreign_keys
        configure_sqlite_foreign_keys(self.engine)
        with self.engine.begin() as connection:
            connection.execute(text('CREATE TABLE users (id INTEGER PRIMARY KEY)'))
            connection.execute(text('INSERT INTO users (id) VALUES (1),(2),(3)'))
            connection.execute(text('''CREATE TABLE join_requests (
                id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id),
                user_id INTEGER NOT NULL UNIQUE REFERENCES users(id), status VARCHAR NOT NULL,
                created_at DATETIME)'''))
            connection.execute(text("INSERT INTO join_requests VALUES (10,1,3,'approved','2026-10-01')"))
            connection.execute(text('''CREATE TABLE join_selections (
                request_id INTEGER PRIMARY KEY REFERENCES join_requests(id), owner_id INTEGER,
                offer_id INTEGER NOT NULL, start_date DATE NOT NULL)'''))
            connection.execute(text("INSERT INTO join_selections VALUES (10,1,7,'2026-10-02')"))
        with self.engine.begin() as connection:
            connection.exec_driver_sql('BEGIN IMMEDIATE')
            migrations.allow_multi_mess_memberships(connection)
            connection.execute(text("INSERT INTO join_requests VALUES (11,2,3,'pending','2026-10-03')"))
            self.assertEqual(connection.execute(text('SELECT id,owner_id,user_id,status FROM join_requests ORDER BY id')).all(),
                             [(10,1,3,'approved'),(11,2,3,'pending')])
            self.assertEqual(connection.execute(text('SELECT request_id,offer_id FROM join_selections')).one(), (10,7))
            unique = inspect(connection).get_unique_constraints('join_requests')
            self.assertFalse(any(item.get('column_names') == ['user_id'] for item in unique))

    def test_legacy_upgrade_preserves_records_and_backfills_once(self):
        with self.engine.begin() as connection:
            connection.execute(text('CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, phone VARCHAR UNIQUE NOT NULL, password_hash VARCHAR NOT NULL, role VARCHAR, language_pref VARCHAR, created_at DATETIME)'))
            connection.execute(text("INSERT INTO users VALUES (7,'Owner','9876543200','preserved-hash','owner','en','2026-10-01'),(8,'Customer','9876543201','customer-hash','customer','hi','2026-10-02')"))
            connection.execute(text('CREATE TABLE meal_plans (id INTEGER PRIMARY KEY, user_id INTEGER, plan_type VARCHAR, price NUMERIC(10,2), start_date DATE, end_date DATE, status VARCHAR)'))
            connection.execute(text("INSERT INTO meal_plans VALUES (10,8,'Legacy',700,'2026-10-01','2026-10-31','active')"))
            connection.execute(text('CREATE TABLE meal_orders (id INTEGER PRIMARY KEY, user_id INTEGER, meal_id INTEGER, status VARCHAR, extra_items VARCHAR, extra_cost NUMERIC)'))
            connection.execute(text("INSERT INTO meal_orders (id,user_id,meal_id,status) VALUES (12,8,20,'skipped')"))
            connection.execute(text('CREATE TABLE payment_records (id INTEGER PRIMARY KEY, plan_id INTEGER NOT NULL, amount NUMERIC(10,2) NOT NULL, reference VARCHAR, receipt_key VARCHAR UNIQUE NOT NULL, created_at DATETIME)'))
            connection.execute(text("INSERT INTO payment_records VALUES (11,10,200,'Legacy receipt','keep-receipt','2026-10-03')"))
            before = connection.execute(text('SELECT id,name,phone,password_hash,role,language_pref,created_at FROM users ORDER BY id')).all()
        migrate.upgrade(self.engine, allow_legacy_upgrade=True)
        with self.engine.begin() as connection:
            self.assertEqual(connection.execute(text('SELECT id,name,phone,password_hash,role,language_pref,created_at FROM users ORDER BY id')).all(), before)
            self.assertEqual(connection.execute(text('SELECT price,start_date,end_date,original_end_date,skip_count,owner_id FROM meal_plans')).one(), (700,'2026-10-01','2026-10-31','2026-10-31',0,7))
            self.assertEqual(connection.execute(text('SELECT id,plan_id,amount,reference,receipt_key,owner_id FROM payment_records')).one(), (11,10,200,'Legacy receipt','keep-receipt',7))
            self.assertEqual(connection.execute(text('SELECT status,extension_credit FROM meal_orders WHERE id=12')).one(), ('skipped',1))
            self.assertEqual(connection.execute(text('SELECT owner_id FROM mess_installation WHERE id=1')).scalar(), 7)
            connection.execute(text('UPDATE meal_plans SET original_end_date=NULL'))
        migrate.upgrade(self.engine)
        with self.engine.connect() as connection:
            self.assertIsNone(connection.execute(text('SELECT original_end_date FROM meal_plans')).scalar())

    def test_failed_migration_rolls_back_schema_and_revision(self):
        def fail(connection):
            migrate.baseline(connection)
            raise RuntimeError('injected failure')
        with patch.dict(migrate.OPERATIONS, {'0001_baseline': fail}):
            with self.assertRaisesRegex(RuntimeError, 'injected failure'):
                migrate.upgrade(self.engine)
        self.assertEqual(inspect(self.engine).get_table_names(), [])
        self.assertEqual(migrate.upgrade(self.engine), list(migrate.REVISIONS))

    def test_unsupported_legacy_shape_is_not_stamped(self):
        with self.engine.begin() as connection:
            connection.execute(text('CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR)'))
        with self.assertRaisesRegex(RuntimeError, 'Unsupported legacy schema'):
            migrate.upgrade(self.engine, allow_legacy_upgrade=True)
        self.assertEqual(inspect(self.engine).get_table_names(), ['users'])

    def test_unknown_revision_and_incomplete_versioned_schema_fail(self):
        migrate.upgrade(self.engine)
        with self.engine.begin() as connection:
            connection.execute(migrate.VERSION_TABLE.insert().values(revision='future', applied_at=migrate.datetime.now()))
        with self.assertRaisesRegex(RuntimeError, 'unsupported migration revision'):
            migrate.require_current_schema(self.engine)

    def test_app_import_does_not_connect_or_execute_migrations(self):
        script = "from unittest.mock import patch\nfrom sqlalchemy.engine import Engine\nwith patch.object(Engine, 'connect', side_effect=AssertionError('import connected')):\n from app.main import app\n print('import-safe')"
        env = os.environ.copy()
        env.update(DATABASE_URL='sqlite://', APP_ENV='test', SECRET_KEY='import-test-secret', RENDER='false')
        result = subprocess.run([sys.executable, '-B', '-c', script], cwd=Path(__file__).parent,
                                env=env, capture_output=True, text=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('import-safe', result.stdout)

    def test_cli_requires_explicit_target(self):
        env = os.environ.copy()
        env.pop('DATABASE_URL', None)
        result = subprocess.run([sys.executable, '-B', 'migrate_database.py', 'upgrade'],
                                cwd=Path(__file__).parent, env=env, capture_output=True, text=True, timeout=20)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Set DATABASE_URL explicitly', result.stderr)

    def test_concurrent_sqlite_migrators_apply_one_revision(self):
        with TemporaryDirectory() as folder:
            engine = create_engine('sqlite:///' + (Path(folder) / 'migrations.db').as_posix(), connect_args={'timeout': 20})
            try:
                with ThreadPoolExecutor(max_workers=3) as workers:
                    results = list(workers.map(lambda _: migrate.upgrade(engine), range(3)))
                self.assertEqual(sum(bool(result) for result in results), 1)
                migrate.require_current_schema(engine)
            finally:
                engine.dispose()

    def test_api_startup_rejects_unmigrated_schema_without_writes(self):
        import asyncio
        from app.main import lifespan
        async def start():
            async with lifespan(None):
                self.fail('Unmigrated startup was accepted')
        with patch('app.main.engine', self.engine):
            with self.assertRaisesRegex(RuntimeError, 'explicit migration command'):
                asyncio.run(start())
        self.assertEqual(inspect(self.engine).get_table_names(), [])

    def test_postgres_fixture_rejects_non_test_targets(self):
        for url in ('postgresql://user@localhost/postgres', 'postgresql://user@localhost/mess', 'sqlite:///mess_manager_test'):
            with self.assertRaises(ValueError):
                test_database_url(url)
        self.assertEqual(test_database_url('postgresql+psycopg://user@localhost/mess_manager_test_batch4').database, 'mess_manager_test_batch4')

    def test_wrong_primary_key_and_type_are_not_adopted(self):
        models.Base.metadata.create_all(self.engine)
        with self.engine.begin() as connection:
            connection.execute(text('DROP TABLE auth_attempt_buckets'))
            connection.execute(text('CREATE TABLE auth_attempt_buckets (key INTEGER, attempts INTEGER, window_start DATETIME)'))
        report = migrate.status(self.engine)
        self.assertIn('auth_attempt_buckets', report['unsupported_primary_keys'])
        self.assertIn('auth_attempt_buckets', report['unsupported_column_types'])
        with self.assertRaisesRegex(RuntimeError, 'Unsupported legacy schema'):
            migrate.upgrade(self.engine, allow_legacy_upgrade=True)

    def test_incomplete_versioned_schema_is_not_repaired_implicitly(self):
        migrate.upgrade(self.engine)
        with self.engine.begin() as connection:
            connection.execute(text('DROP TABLE auth_attempt_buckets'))
        with self.assertRaisesRegex(RuntimeError, 'not current'):
            migrate.require_current_schema(self.engine)
        with self.assertRaisesRegex(RuntimeError, 'incomplete'):
            migrate.upgrade(self.engine)

    def test_read_only_status_does_not_create_a_sqlite_file(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / 'not-created.db'
            engine = create_engine('sqlite:///' + path.as_posix())
            try:
                with self.assertRaisesRegex(RuntimeError, 'does not exist'):
                    migrate.status(engine)
                self.assertFalse(path.exists())
            finally:
                engine.dispose()

    def test_cli_configuration_failure_does_not_echo_credentials(self):
        env = os.environ.copy()
        env['DATABASE_URL'] = 'invalid-fixture-url-with-private-password'
        result = subprocess.run([sys.executable, '-B', 'migrate_database.py', 'status'],
                                cwd=Path(__file__).parent, env=env, capture_output=True, text=True, timeout=20)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Migration command failed', result.stderr)
        self.assertNotIn('private-password', result.stderr)


if __name__ == '__main__':
    unittest.main()
