"""Shared validation for user supplied PNG and JPEG uploads."""

import re

MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024


def image_extension(content: bytes, *, strict_png: bool = False, strict_jpeg: bool = False) -> str | None:
    """Return a safe extension for supported image bytes, or None when invalid.

    The strict flags preserve the validation used by the existing upload flows:
    menu uploads check PNG length/chunks, while payment screenshots historically
    accepted the shorter PNG signature check.
    """
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        if strict_png and not (
            len(content) >= 45
            and content[12:16] == b"IHDR"
            and content.endswith(b"IEND\xaeB`\x82")
        ):
            return None
        return ".png"
    if content.startswith(b"\xff\xd8\xff"):
        if strict_jpeg and not (len(content) >= 20 and content.endswith(b"\xff\xd9")):
            return None
        return ".jpg"
    return None


def stored_payment_image(directory, url):
    """Resolve only immutable UUID filenames created by the QR upload endpoint."""
    if not isinstance(url, str):
        return None
    match = re.fullmatch(r"/payment-images/([0-9a-f]{32}\.(?:png|jpg))", url)
    return directory / match.group(1) if match else None
