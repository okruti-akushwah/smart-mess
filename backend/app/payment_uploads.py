from pathlib import Path

PAYMENT_IMAGE_DIR = Path(__file__).resolve().parents[1] / "payment_images"
PAYMENT_IMAGE_DIR.mkdir(exist_ok=True)
