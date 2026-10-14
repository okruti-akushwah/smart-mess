"""Database-backed password attempt limits shared by all API workers."""
import hashlib
import math
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import case, or_, update
from sqlalchemy.exc import IntegrityError
from app import models


WINDOW_SECONDS = 900
ACCOUNT_LIMIT = 10
IP_LIMIT = 100


def bucket_key(kind, value):
    return hashlib.sha256(f"{kind}:{value.strip()}".encode()).hexdigest()


def reserve(db, request, phone):
    now = datetime.utcnow()
    expired = now - timedelta(seconds=WINDOW_SECONDS)
    host = request.client.host if request.client else "unknown"
    limits = {bucket_key("account", phone): ACCOUNT_LIMIT, bucket_key("ip", host): IP_LIMIT}
    retry_after = 0
    # Stable order prevents deadlocks when workers share an account or address.
    for key, limit in sorted(limits.items()):
        if db.get(models.AuthAttemptBucket, key) is None:
            try:
                with db.begin_nested():
                    db.add(models.AuthAttemptBucket(key=key, attempts=0, window_start=now))
                    db.flush()
            except IntegrityError:
                pass  # Another worker created this bucket; the atomic update below handles it.
        bucket = models.AuthAttemptBucket
        row = db.execute(update(bucket).where(bucket.key == key,
            or_(bucket.window_start <= expired, bucket.attempts < limit)).values(
                attempts=case((bucket.window_start <= expired, 1), else_=bucket.attempts + 1),
                window_start=case((bucket.window_start <= expired, now), else_=bucket.window_start)
            ).returning(bucket.attempts, bucket.window_start)).first()
        if row is None:
            started = db.query(bucket.window_start).filter_by(key=key).scalar()
            retry_after = max(retry_after, math.ceil((started + timedelta(seconds=WINDOW_SECONDS) - now).total_seconds()))
    # Persist failed attempts independently of the endpoint's subsequent outcome.
    db.commit()
    if retry_after:
        raise HTTPException(429, "Too many login attempts. Please try again later.",
                            headers={"Retry-After": str(max(retry_after, 1))})


def success(db, phone):
    # Successful authentication clears account failures, but not the IP quota.
    db.query(models.AuthAttemptBucket).filter_by(key=bucket_key("account", phone)).update({"attempts": 0})
    db.commit()
