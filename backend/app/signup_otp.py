"""Signup phone verification. Never return OTPs or provider credentials to clients."""
import hashlib
import hmac
import logging
import os
import secrets
from datetime import datetime, timedelta

import httpx
from fastapi import HTTPException
from app import auth, models

logger = logging.getLogger("uvicorn.error")
TTL_SECONDS = 300
COOLDOWN_SECONDS = 60
MAX_ATTEMPTS = 5
MAX_SENDS_PER_HOUR = 5


def mode():
    selected = os.getenv("SIGNUP_OTP_MODE", "twilio").strip().lower()
    if selected not in {"off", "console", "twilio"}:
        raise HTTPException(503, "Invalid SIGNUP_OTP_MODE configuration")
    if selected == "console" and os.getenv("APP_ENV", "development").lower() == "production":
        raise HTTPException(503, "Console OTP mode is not allowed in production")
    return selected


def _digest(challenge_id, code):
    return hmac.new(auth.SECRET_KEY.encode(), f"{challenge_id}:{code}".encode(), hashlib.sha256).hexdigest()


def provider_request(action, phone, code=None):
    sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    service = os.getenv("TWILIO_VERIFY_SERVICE_SID", "").strip()
    if not sid or not token or not service:
        raise HTTPException(503, "SMS verification is not configured. Ask the owner to configure Twilio Verify.")
    payload = {"To": "+91" + phone}
    payload.update({"Code": code} if action == "VerificationCheck" else {"Channel": "sms"})
    try:
        response = httpx.post(f"https://verify.twilio.com/v2/Services/{service}/{action}",
                              auth=(sid, token), data=payload, timeout=12)
    except httpx.RequestError:
        raise HTTPException(503, "SMS service is unavailable. Please try again later.")
    if response.status_code == 429:
        raise HTTPException(429, "Too many OTP requests. Please try again later.")
    if action == "VerificationCheck" and response.status_code in (400, 404):
        return False
    if response.status_code not in (200, 201):
        raise HTTPException(503, "SMS service rejected the request. Ask the owner to check their SMS settings.")
    try:
        return response.json().get("status") == "approved" if action == "VerificationCheck" else True
    except ValueError:
        raise HTTPException(503, "SMS service is unavailable. Please try again later.")


def start(db, phone, scope):
    from sqlalchemy.exc import IntegrityError
    selected = mode()
    if selected == "off":
        return {"verification_id": None, "otp_required": False}
    if not db.get(models.SignupOtpPhone, phone):
        db.add(models.SignupOtpPhone(phone=phone))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    db.query(models.SignupOtpPhone).filter_by(phone=phone).with_for_update().first()
    now = datetime.utcnow()
    recent = db.query(models.SignupChallenge).filter(models.SignupChallenge.phone == phone,
        models.SignupChallenge.created_at > now - timedelta(hours=1)).order_by(models.SignupChallenge.created_at.desc()).all()
    if recent and (now - recent[0].created_at).total_seconds() < COOLDOWN_SECONDS:
        raise HTTPException(429, "Please wait 60 seconds before requesting another OTP.")
    if len(recent) >= MAX_SENDS_PER_HOUR:
        raise HTTPException(429, "OTP limit reached. Please try again in an hour.")
    challenge_id = secrets.token_urlsafe(32)
    code = f"{secrets.randbelow(1000000):06d}" if selected == "console" else None
    if selected == "twilio":
        provider_request("Verifications", phone)
    db.query(models.SignupChallenge).filter_by(phone=phone, consumed=False).update({"consumed": True})
    db.add(models.SignupChallenge(id=challenge_id, phone=phone, scope=scope, mode=selected,
        code_hash=_digest(challenge_id, code) if code else None, created_at=now,
        expires_at=now + timedelta(seconds=TTL_SECONDS)))
    db.commit()
    if selected == "console":
        logger.warning("LOCAL TEST ONLY - signup OTP for phone ending %s: %s (expires in 5 minutes; no SMS sent)", phone[-4:], code)
    return {"otp_required": True, "challenge_id": challenge_id,
        "masked_phone": "******" + phone[-4:], "expires_in": TTL_SECONDS,
        "resend_after": COOLDOWN_SECONDS, "delivery": selected,
        "message": "Local test mode: read the OTP in the backend terminal. No SMS was sent." if selected == "console" else "OTP sent to your registered mobile number."}


def verify(db, challenge_id, code):
    item = db.query(models.SignupChallenge).filter_by(id=challenge_id).with_for_update().first()
    if not item or item.consumed or item.verified or item.expires_at <= datetime.utcnow() or item.mode != mode():
        raise HTTPException(400, "OTP expired or already used. Please start signup again.")
    if item.attempts >= MAX_ATTEMPTS:
        raise HTTPException(429, "Too many incorrect attempts. Please start signup again.")
    item.attempts += 1
    try:
        valid = hmac.compare_digest(item.code_hash or "", _digest(item.id, code)) if item.mode == "console" else provider_request("VerificationCheck", item.phone, code)
    except HTTPException:
        db.commit()
        raise
    if not valid:
        db.commit()
        raise HTTPException(400, "Incorrect OTP. Please check the code and try again.")
    item.verified = True
    db.commit()
    return {"verification_id": item.id, "message": "Mobile number verified. Complete your registration."}


def complete(db, verification_id, phone, scope):
    if mode() == "off":
        return
    item = db.query(models.SignupChallenge).filter_by(id=verification_id).with_for_update().first() if verification_id else None
    if not item or not item.verified or item.consumed or item.phone != phone or item.scope != scope or item.expires_at <= datetime.utcnow() or item.mode != mode():
        raise HTTPException(403, "Verify your mobile number before creating your account.")
    item.consumed = True
