"""Guard deployment/test dependency parity and multipart security limits."""
from importlib.metadata import version
from pathlib import Path
import platform
import re
import sys
import unittest

from python_multipart.exceptions import MultipartParseError
from python_multipart.multipart import MultipartParser


BACKEND = Path(__file__).resolve().parent
UVLOOP_MARKER = ('sys_platform != "win32" and sys_platform != "cygwin" '
                 'and platform_python_implementation != "PyPy"')


def locked_requirements():
    rows = []
    for line in (BACKEND / "requirements.txt").read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        match = re.fullmatch(r"([A-Za-z0-9_.-]+)(?:\[[A-Za-z0-9_,.-]+\])?==([A-Za-z0-9_.+-]+)(?:;\s*(.+))?", line)
        if not match:
            raise AssertionError(f"Dependency must have one exact version: {line}")
        rows.append(match.groups())
    return rows


class DependencyTests(unittest.TestCase):
    def test_test_manifest_uses_deployment_lock(self):
        lines = [line.strip() for line in (BACKEND / "requirements-tested.txt").read_text().splitlines()
                 if line.strip() and not line.lstrip().startswith("#")]
        self.assertEqual(lines, ["-r requirements.txt"])

    def test_lock_has_unique_exact_pins(self):
        rows = locked_requirements()
        names = [re.sub(r"[-_.]+", "-", name).lower() for name, _, _ in rows]
        self.assertEqual(len(names), len(set(names)))
        self.assertTrue(rows)
        for name, _, marker in rows:
            if marker:
                self.assertEqual(name, "uvloop")
                self.assertEqual(marker, UVLOOP_MARKER)

    def test_installed_environment_matches_lock(self):
        for name, expected, marker in locked_requirements():
            if marker and (sys.platform in {"win32", "cygwin"} or platform.python_implementation() == "PyPy"):
                continue
            with self.subTest(package=name):
                self.assertEqual(version(name), expected)

    def test_security_fixes_cannot_be_downgraded(self):
        pins = {name.lower(): pinned for name, pinned, _ in locked_requirements()}
        for name, minimum in {"python-multipart": (0, 0, 27), "python-jose": (3, 4, 0)}.items():
            with self.subTest(package=name):
                self.assertGreaterEqual(tuple(int(part) for part in pins[name].split(".")), minimum)

    def test_multipart_accepts_normal_upload(self):
        chunks = []
        parser = MultipartParser(b"test", {"on_part_data": lambda data, start, end: chunks.append(data[start:end])})
        parser.write(b'--test\r\nContent-Disposition: form-data; name="file"; filename="meal.png"\r\n'
                     b'Content-Type: image/png\r\n\r\nimage-data\r\n--test--\r\n')
        parser.finalize()
        self.assertEqual(b"".join(chunks), b"image-data")

    def test_multipart_rejects_oversized_part_header(self):
        parser = MultipartParser(b"test")
        with self.assertRaises(MultipartParseError):
            parser.write(b"--test\r\nX-Test: " + b"a" * 5000 + b"\r\n\r\ndata\r\n--test--\r\n")

    def test_multipart_rejects_excessive_part_headers(self):
        parser = MultipartParser(b"test")
        with self.assertRaises(MultipartParseError):
            parser.write(b"--test\r\n" + b"X-Test: a\r\n" * 9 + b"\r\ndata\r\n--test--\r\n")


if __name__ == "__main__":
    unittest.main()
