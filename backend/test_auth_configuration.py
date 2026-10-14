"""Validate auth startup and independent workers without connecting to a database."""
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest


BACKEND = Path(__file__).resolve().parent
TEST_SECRET = "batch-two-independent-worker-test-secret"


class AuthConfigurationTests(unittest.TestCase):
    def run_config(self, code="print('ready')", **settings):
        env = os.environ.copy()
        env.update(APP_ENV="production", RENDER="false", DATABASE_URL="sqlite://",
                   SECRET_KEY=TEST_SECRET, ALGORITHM="HS256", ACCESS_TOKEN_EXPIRE_MINUTES="1440")
        for name, value in settings.items():
            if value is None:
                env.pop(name, None)
            else:
                env[name] = value
        # Mock local dotenv reads so tests never consume the developer's secrets.
        script = ("from unittest.mock import patch\n"
                  "with patch('dotenv.load_dotenv') as local_env:\n"
                  "    from app import auth\n" +
                  "\n".join("    " + line for line in code.splitlines()))
        return subprocess.run([sys.executable, "-B", "-c", script], cwd=BACKEND,
                              env=env, capture_output=True, text=True, timeout=20)

    def assert_ready(self, result):
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_production_requires_nonblank_secret(self):
        for secret in (None, "", "   "):
            with self.subTest(secret=secret):
                result = self.run_config(SECRET_KEY=secret)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("persistent SECRET_KEY", result.stderr)

    def test_render_requires_secret_even_in_development(self):
        result = self.run_config(APP_ENV="development", RENDER="true", SECRET_KEY="",
                                 DATABASE_URL="postgresql://test:test@localhost/test")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("persistent SECRET_KEY", result.stderr)

    def test_render_defaults_to_production(self):
        result = self.run_config("assert auth.APP_ENV == 'production'\nlocal_env.assert_not_called()",
                                 APP_ENV=None, RENDER="true", DATABASE_URL="postgresql://test:test@localhost/test")
        self.assert_ready(result)

    def test_test_mode_requires_secret(self):
        result = self.run_config(APP_ENV="test", SECRET_KEY="")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("persistent SECRET_KEY", result.stderr)

    def test_development_fallback_warns_without_exposing_secret(self):
        result = self.run_config("assert len(auth.SECRET_KEY) >= 48", APP_ENV="development", SECRET_KEY="")
        self.assert_ready(result)
        self.assertIn("development sessions", result.stderr)
        self.assertEqual(result.stdout, "")

    def test_production_does_not_load_local_dotenv(self):
        result = self.run_config("local_env.assert_not_called()", APP_ENV=" Production ")
        self.assert_ready(result)

    def test_development_preserves_local_dotenv_loading(self):
        result = self.run_config("local_env.assert_called_once()", APP_ENV="development")
        self.assert_ready(result)

    def test_invalid_environment_fails_clearly(self):
        result = self.run_config(APP_ENV="prodution")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("APP_ENV must be", result.stderr)

    def test_invalid_algorithms_fail_at_import(self):
        for algorithm in ("none", "RS256", "", "unknown"):
            with self.subTest(algorithm=algorithm):
                result = self.run_config(ALGORITHM=algorithm)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("ALGORITHM must be", result.stderr)

    def test_invalid_lifetimes_fail_at_import(self):
        for minutes in ("0", "-1", "abc", "1.5", "", "99999999999999999999"):
            with self.subTest(minutes=minutes):
                result = self.run_config(ACCESS_TOKEN_EXPIRE_MINUTES=minutes)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("ACCESS_TOKEN_EXPIRE_MINUTES must be", result.stderr)

    def test_default_lifetime_is_preserved(self):
        result = self.run_config("assert auth.ACCESS_TOKEN_EXPIRE_MINUTES == 1440",
                                 ACCESS_TOKEN_EXPIRE_MINUTES=None)
        self.assert_ready(result)

    def test_token_has_configured_expiration(self):
        result = self.run_config(
            "from datetime import datetime, timezone\n"
            "token = auth.create_access_token({'sub': '42', 'role': 'customer'})\n"
            "remaining = auth.decode_access_token(token)['exp'] - datetime.now(timezone.utc).timestamp()\n"
            "assert 175 <= remaining <= 180", ACCESS_TOKEN_EXPIRE_MINUTES="3")
        self.assert_ready(result)

    def test_independent_workers_and_restarts_accept_same_token(self):
        for algorithm in ("HS256", "HS384", "HS512"):
            with self.subTest(algorithm=algorithm):
                issuer = self.run_config("print(auth.create_access_token({'sub': '42', 'role': 'customer'}))",
                                         ALGORITHM=algorithm)
                self.assert_ready(issuer)
                token = issuer.stdout.strip()
                code = ("import json, os\n"
                        "print(json.dumps(auth.decode_access_token(os.environ['BATCH_TWO_TOKEN'])))")
                for _ in range(2):
                    worker = self.run_config(code, ALGORITHM=algorithm, BATCH_TWO_TOKEN=token)
                    self.assert_ready(worker)
                    self.assertEqual(json.loads(worker.stdout)["sub"], "42")
                rotated = self.run_config(code, ALGORITHM=algorithm, BATCH_TWO_TOKEN=token,
                                          SECRET_KEY="different-worker-test-secret")
                self.assertNotEqual(rotated.returncode, 0)
                self.assertNotIn("different-worker-test-secret", rotated.stderr)

    def test_configured_secret_is_not_trimmed(self):
        result = self.run_config("assert auth.SECRET_KEY == '  preserved-test-secret  '",
                                 SECRET_KEY="  preserved-test-secret  ")
        self.assert_ready(result)


if __name__ == "__main__":
    unittest.main()
