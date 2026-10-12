"""Check deployment configuration without connecting to any live database."""
import os
from pathlib import Path
import subprocess
import sys
import unittest


class DatabaseConfigurationTests(unittest.TestCase):
    def run_config(self, render, url):
        env = os.environ.copy()
        env.update(RENDER=render, DATABASE_URL=url)
        return subprocess.run(
            [sys.executable, "-c", "from app.database import engine; print(engine.url.drivername)"],
            cwd=Path(__file__).parent, env=env, capture_output=True, text=True,
        )

    def test_render_missing_url_cannot_load_local_dotenv(self):
        result = self.run_config("true", "")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Set DATABASE_URL in Render Environment", result.stderr)

    def test_render_rejects_temporary_sqlite(self):
        result = self.run_config("true", "sqlite://")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("persistent PostgreSQL", result.stderr)

    def test_local_sqlite_still_works(self):
        result = self.run_config("false", "sqlite://")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "sqlite")

    def test_render_accepts_postgres_alias_without_connecting(self):
        result = self.run_config("true", "postgres://test:test@localhost/test")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "postgresql")


if __name__ == "__main__":
    unittest.main()
