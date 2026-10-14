"""Opt-in PostgreSQL fixtures: dedicated test database and a disposable schema."""
from contextlib import contextmanager
import os
import re
import unittest
from uuid import uuid4

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


def test_database_url(value):
    url = make_url(value)
    if url.get_backend_name() != "postgresql" or not re.fullmatch(r"mess_manager_test(?:_[a-z0-9_]+)?", url.database or ""):
        raise ValueError("PostgreSQL fixtures require a dedicated database named mess_manager_test or mess_manager_test_<suffix>")
    return url


@contextmanager
def postgres_database():
    if os.getenv("RUN_POSTGRES_TESTS") != "1" or not os.getenv("TEST_POSTGRES_URL"):
        raise unittest.SkipTest("Set RUN_POSTGRES_TESTS=1 and TEST_POSTGRES_URL to an isolated PostgreSQL test database")
    url = test_database_url(os.environ["TEST_POSTGRES_URL"])
    schema = "app_test_" + uuid4().hex
    arguments = {"prepare_threshold": None} if url.drivername == "postgresql+psycopg" else {}
    admin = create_engine(url, connect_args=arguments)
    engine = None
    created = False
    try:
        with admin.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
            created = True
        engine = create_engine(url, connect_args={**arguments, "options": f"-csearch_path={schema}"})
        with engine.connect() as connection:
            if connection.execute(text("SELECT current_schema()")).scalar() != schema:
                raise RuntimeError("PostgreSQL fixture failed to isolate its schema")
        yield engine
    finally:
        if engine is not None:
            engine.dispose()
        if created:
            # Only the randomly generated schema owned by this fixture is removed.
            if not re.fullmatch(r"app_test_[0-9a-f]{32}", schema):
                raise RuntimeError("Refusing unsafe fixture cleanup")
            with admin.begin() as connection:
                connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()
