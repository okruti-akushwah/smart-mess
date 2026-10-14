import os
import secrets
import logging
from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db, ON_RENDER

APP_ENV = os.getenv("APP_ENV", "production" if ON_RENDER else "development").strip().lower()
if APP_ENV not in {"development", "test", "production"}:
    raise RuntimeError("APP_ENV must be development, test or production")

SECRET_KEY = os.getenv("SECRET_KEY", "")
if not SECRET_KEY.strip():
    if ON_RENDER or APP_ENV != "development":
        raise RuntimeError("Set a persistent SECRET_KEY for production and test environments")
    SECRET_KEY = secrets.token_urlsafe(48)
    logging.getLogger("uvicorn.error").warning(
        "SECRET_KEY is missing: development sessions and console OTPs will not survive restarts or work across workers"
    )
# Preserve configured secret bytes so existing tokens and OTP digests stay valid.
ALGORITHM = os.getenv("ALGORITHM", "HS256")
if ALGORITHM not in {"HS256", "HS384", "HS512"}:
    raise RuntimeError("ALGORITHM must be HS256, HS384 or HS512 for the shared signing secret")
try:
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    if ACCESS_TOKEN_EXPIRE_MINUTES <= 0:
        raise ValueError
    datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
except (ValueError, OverflowError):
    raise RuntimeError("ACCESS_TOKEN_EXPIRE_MINUTES must be a positive integer within the supported datetime range") from None

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def verify_password_limited(db, request, phone, password, user):
    from app import auth_attempts
    auth_attempts.reserve(db, request, phone)
    # A missing account still does bcrypt work and receives the same login error.
    dummy_hash = "$2b$12$ttwfbIJvwoS2B9WoSV5HheqW5Q4FvZrCY49/Nrr0GhkQmc4wPSuSi"
    try:
        valid = verify_password(password, user.password_hash if user else dummy_hash)
    except (ValueError, TypeError):
        valid = False
    if not user or not valid:
        return False
    auth_attempts.success(db, phone)
    return True


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")


def _user_from_token(token, db):
    from app import models  # imported here to avoid circular import issues

    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(401, "Invalid or expired token")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(401, "User not found")
    from app.installation import check_owner
    check_owner(db, user)
    return user


def get_current_identity(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Authenticate without selecting a mess, for account-level membership screens."""
    return _user_from_token(token, db)


def get_current_user(request: Request, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    from app import models
    from app.tenancy import owner_for_user, scope
    user = _user_from_token(token, db)
    owner_id = owner_for_user(db, user, request.headers.get("X-Mess-Token"))
    membership = db.query(models.JoinRequest).filter_by(user_id=user.id, owner_id=owner_id).first()
    if membership and membership.status != "approved" and request.url.path != "/join-status":
        raise HTTPException(403, "Your mess join request is awaiting approval or was declined")
    scope(db, owner_id)
    return user
