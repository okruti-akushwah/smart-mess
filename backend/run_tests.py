"""Run isolated regressions from any working directory; PostgreSQL is opt-in."""
import argparse
import importlib
import inspect
import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pattern', default='test_*.py')
    args = parser.parse_args()
    backend = Path(__file__).resolve().parent
    sys.path.insert(0, str(backend))
    os.environ.update(DATABASE_URL='sqlite://', APP_ENV='test', RENDER='false',
                      SECRET_KEY='isolated-test-secret-not-for-production', ALGORITHM='HS256',
                      ACCESS_TOKEN_EXPIRE_MINUTES='1440', SIGNUP_OTP_MODE='off',
                      SMTP_HOST='', CLOUDFLARE_API_TOKEN='', TWILIO_AUTH_TOKEN='')
    with TemporaryDirectory(prefix='mess-tests-') as folder:
        from app import menu_images, payment_uploads
        menu_images.IMAGE_DIR = Path(folder) / 'menus'
        payment_uploads.PAYMENT_IMAGE_DIR = Path(folder) / 'qr'
        menu_images.IMAGE_DIR.mkdir()
        payment_uploads.PAYMENT_IMAGE_DIR.mkdir()
        from app.routes import workflow_routes
        workflow_routes.PROOF_DIR = Path(folder) / 'proofs'
        workflow_routes.PROOF_DIR.mkdir()
        suite = unittest.TestSuite()
        for path in sorted(backend.glob(args.pattern)):
            module = importlib.import_module(path.stem)
            for _, cls in inspect.getmembers(module, inspect.isclass):
                if cls.__module__ != module.__name__ or not issubclass(cls, unittest.TestCase):
                    continue
                for method in cls.__dict__:
                    if method.startswith('test_'):
                        suite.addTest(cls(method))
        if not suite.countTestCases():
            parser.error('No tests matched the requested pattern')
        result = unittest.TextTestRunner(verbosity=2).run(suite)
        return int(not result.wasSuccessful())


if __name__ == '__main__':
    raise SystemExit(main())
