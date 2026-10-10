from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth, signup_otp


router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------
# SIGNUP
# ---------------------------------------------------------

from pydantic import Field
from sqlalchemy.exc import IntegrityError
from app.installation import initialize, check_owner

class OwnerSetup(schemas.UserCreate):
    mess_name: str = Field(default='', max_length=100)
    verification_id: str | None = Field(default=None, max_length=64)

@router.get('/registration-status')
def registration_status(db: Session = Depends(get_db)):
    installation = initialize(db)
    if not installation:
        return {'setup_available': True, 'mess_name': None, 'join_token': None}
    from app.routes.profile_routes import output
    profile = output(db.get(models.User, installation.owner_id), db)
    return {'setup_available': True, 'mess_name': profile['name'], 'join_token': profile['join_token']}

@router.post('/signup', response_model=schemas.UserOut)
def signup(user: OwnerSetup, db: Session = Depends(get_db)):
    if user.role != 'owner':
        raise HTTPException(403, 'Customers must register using the mess QR or join link')
    if not user.mess_name.strip() or not user.name.strip():
        raise HTTPException(422, 'Enter your name and mess name')
    if db.query(models.User).filter_by(phone=user.phone).first():
        raise HTTPException(409, 'Phone number already registered')
    signup_otp.complete(db, user.verification_id, user.phone, "owner")
    new_user = models.User(name=user.name.strip(), phone=user.phone,
                           password_hash=auth.hash_password(user.password), role='owner')
    try:
        db.add(new_user)
        db.flush()
        db.add(models.MessProfile(owner_id=new_user.id, name=user.mess_name.strip()))
        import secrets
        db.add(models.JoinInvite(owner_id=new_user.id, token=secrets.token_urlsafe(24)))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'This phone is already registered. Please log in.')
    db.refresh(new_user)
    initialize(db)
    return new_user


# ---------------------------------------------------------
# NORMAL LOGIN
# Used by React frontend
# ---------------------------------------------------------

@router.post("/login")
def login(
    credentials: schemas.UserLogin,
    db: Session = Depends(get_db)
):
    user = (
        db.query(models.User)
        .filter(
            models.User.phone
            == credentials.phone
        )
        .first()
    )

    if (
        not user
        or not auth.verify_password(
            credentials.password,
            user.password_hash
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid phone number or password"
        )

    check_owner(db, user)
    token = auth.create_access_token(
        {
            "sub": str(user.id),
            "role": user.role,
        }
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
    }


# ---------------------------------------------------------
# SWAGGER / OAUTH LOGIN
# Used by Swagger's Authorize button
# ---------------------------------------------------------

@router.post("/token")
def swagger_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    # Swagger calls this field "username".
    # In our application, username = phone number.
    user = (
        db.query(models.User)
        .filter(
            models.User.phone
            == form_data.username
        )
        .first()
    )

    if (
        not user
        or not auth.verify_password(
            form_data.password,
            user.password_hash
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid phone number or password"
        )

    check_owner(db, user)
    token = auth.create_access_token(
        {
            "sub": str(user.id),
            "role": user.role,
        }
    )

    return {
        "access_token": token,
        "token_type": "bearer",
    }

from pydantic import BaseModel

class SignupOtpRequest(BaseModel):
    phone: str = Field(pattern=r"^[0-9]{10}$")
    join_token: str | None = Field(default=None, max_length=100)

class SignupOtpCheck(BaseModel):
    challenge_id: str = Field(min_length=20, max_length=64)
    code: str = Field(pattern=r"^[0-9]{6}$")

@router.get("/signup/settings")
def signup_settings():
    demo = signup_otp.mode() == "off"
    return {"demo_registration": demo, "otp_required": not demo}

@router.post("/signup/otp")
def send_signup_otp(body: SignupOtpRequest, db: Session = Depends(get_db)):
    if body.join_token:
        from app.routes.join_routes import find_invite
        find_invite(body.join_token, db)
        scope = "join:" + body.join_token
    else:
        scope = "owner"
    return signup_otp.start(db, body.phone, scope)

@router.post("/signup/verify-otp")
def check_signup_otp(body: SignupOtpCheck, db: Session = Depends(get_db)):
    return signup_otp.verify(db, body.challenge_id, body.code)
