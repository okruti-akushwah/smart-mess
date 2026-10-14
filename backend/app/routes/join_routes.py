import secrets
from datetime import date, timedelta
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.meal_coverage import included_types
from app import models, schemas, auth, signup_otp
from app.auth import get_current_identity
from app.database import get_db
from app.routes.owner_meal_routes import require_owner

router = APIRouter(tags=["join mess"])


@router.get('/owner/join-link')
def invite(db: Session = Depends(get_db), owner=Depends(require_owner)):
    item = db.get(models.JoinInvite, owner.id)
    if not item:
        item = models.JoinInvite(owner_id=owner.id, token=secrets.token_urlsafe(24))
        db.add(item)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            item = db.get(models.JoinInvite, owner.id)
    return {'token': item.token, 'owner_name': owner.name}


def find_invite(token, db):
    item = db.query(models.JoinInvite).filter_by(token=token).first()
    if not item:
        raise HTTPException(404, 'This join link is invalid. Ask your owner for the correct QR.')
    return item


@router.get('/join/{token}')
def details(token: str, db: Session = Depends(get_db)):
    item = find_invite(token, db)
    profile = db.get(models.MessProfile, item.owner_id)
    return {'owner_name': db.get(models.User, item.owner_id).name, 'mess_name': profile.name if profile and profile.name else None}


class JoinInput(schemas.UserCreate):
    # Existing customers may resubmit with a legacy password; new accounts are checked below.
    password: str = Field(min_length=1, max_length=72)
    offer_id: int | None = None
    start_date: date | None = None
    verification_id: str | None = Field(default=None, max_length=64)


@router.post('/join/{token}', status_code=201)
def join(token: str, body: JoinInput, request: Request, db: Session = Depends(get_db)):
    invitation = find_invite(token, db)
    if body.role != 'customer' or not body.name.strip():
        raise HTTPException(422, 'Enter your name to create a customer account')
    offer = None
    if body.offer_id is not None or body.start_date is not None:
        offer = db.get(models.PlanOffer, body.offer_id) if body.offer_id is not None else None
        if not offer or not offer.active or offer.owner_id != invitation.owner_id or body.start_date is None:
            raise HTTPException(422, 'Choose an available subscription and start date')
        if body.start_date < date.today():
            raise HTTPException(422, 'Choose today or a future start date')
    user = db.query(models.User).filter_by(phone=body.phone).first()
    if user:
        verified = auth.verify_password_limited(db, request, body.phone, body.password, user)
        if user.role != 'customer' or not verified:
            raise HTTPException(409, 'Invalid phone number or password')
        existing = db.query(models.JoinRequest).filter_by(user_id=user.id, owner_id=invitation.owner_id).first()
        if existing:
            if existing.status == 'approved':
                return {'message': 'You are already approved. Log in to request a subscription from Plans & pause.'}
            if existing.status == 'rejected':
                existing.status = 'pending'
        else:
            existing = models.JoinRequest(user_id=user.id, owner_id=invitation.owner_id)
            db.add(existing)
    else:
        if len(body.password) < 8:
            raise HTTPException(422, 'New passwords must contain at least 8 characters.')
        signup_otp.complete(db, body.verification_id, body.phone, 'join:' + token)
        user = models.User(name=body.name.strip(), phone=body.phone, password_hash=auth.hash_password(body.password), role='customer', mess_owner_id=invitation.owner_id)
        db.add(user)
        db.flush()
        existing = models.JoinRequest(user_id=user.id, owner_id=invitation.owner_id)
        db.add(existing)
    db.flush()
    selection = db.get(models.JoinSelection, existing.id)
    if offer and not selection:
        selection = models.JoinSelection(request_id=existing.id, owner_id=invitation.owner_id,
                                         offer_id=offer.id, start_date=body.start_date)
        db.add(selection)
    if offer:
        selection.offer_id = offer.id
        selection.start_date = body.start_date
    elif selection:
        db.delete(selection)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Request already received. Please log in.')
    return {'message': 'Join request sent. Log in with your phone and chosen password to check approval.'}


@router.post('/join/{token}/request')
def request_membership(token: str, db: Session = Depends(get_db), user=Depends(get_current_identity)):
    if user.role != 'customer':
        raise HTTPException(403, 'Only member accounts can request to join a mess')
    invitation = find_invite(token, db)
    existing = db.query(models.JoinRequest).filter_by(user_id=user.id, owner_id=invitation.owner_id).first()
    if not existing and user.mess_owner_id == invitation.owner_id:
        return {'message': 'You are already approved for this mess.'}
    if existing and existing.status == 'approved':
        return {'message': 'You are already approved for this mess.'}
    if existing:
        existing.status = 'pending'
    else:
        existing = models.JoinRequest(user_id=user.id, owner_id=invitation.owner_id)
        db.add(existing)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.query(models.JoinRequest).filter_by(user_id=user.id, owner_id=invitation.owner_id).first()
        if existing:
            return {'message': 'Join request received. The owner will review it.'}
        raise HTTPException(409, 'Unable to create this join request. Please try again.')
    return {'message': 'Join request sent. The owner must approve your membership before you can order.'}


@router.get('/join-status')
def status(request: Request, db: Session = Depends(get_db), user=Depends(get_current_identity)):
    rows = db.query(models.JoinRequest).filter_by(user_id=user.id).order_by(models.JoinRequest.id).all()
    token = request.headers.get('X-Mess-Token')
    if token:
        invitation = db.query(models.JoinInvite).filter_by(token=token).first()
        item = next((row for row in rows if invitation and row.owner_id == invitation.owner_id), None)
        if not item and user.mess_owner_id == (invitation.owner_id if invitation else None):
            return {'status': 'approved', 'owner_name': db.get(models.User, user.mess_owner_id).name,
                    'join_token': token, 'needs_plan': False}
    elif len(rows) == 1:
        item = rows[0]
    elif len(rows) > 1:
        return {'status': 'choose_mess', 'memberships': [_membership_summary(db, row) for row in rows]}
    else:
        item = None
    if not item:
        return {'status': 'none', 'memberships': []}
    return {'status': item.status, 'owner_name': db.get(models.User, item.owner_id).name,
            'join_token': db.get(models.JoinInvite, item.owner_id).token if db.get(models.JoinInvite, item.owner_id) else None,
            'needs_plan': bool(not db.get(models.JoinSelection, item.id))}


def _membership_summary(db, item):
    owner = db.get(models.User, item.owner_id)
    profile = db.get(models.MessProfile, item.owner_id)
    invitation = db.get(models.JoinInvite, item.owner_id)
    return {'owner_id': item.owner_id, 'mess_name': profile.name if profile and profile.name else f"{owner.name}’s mess",
            'join_token': invitation.token if invitation else None, 'status': item.status,
            'needs_plan': not bool(db.get(models.JoinSelection, item.id))}


@router.get('/customer/messes')
def customer_messes(db: Session = Depends(get_db), user=Depends(get_current_identity)):
    if user.role != 'customer':
        raise HTTPException(403, 'Only member accounts can list joined messes')
    rows = db.query(models.JoinRequest).filter_by(user_id=user.id).order_by(models.JoinRequest.id).all()
    invite_created = False
    for owner_id in {row.owner_id for row in rows} | ({user.mess_owner_id} if user.mess_owner_id else set()):
        if not db.get(models.JoinInvite, owner_id):
            db.add(models.JoinInvite(owner_id=owner_id, token=secrets.token_urlsafe(24)))
            invite_created = True
    if invite_created:
        db.commit()
    memberships = [_membership_summary(db, row) for row in rows]
    # Older customer accounts may predate explicit join requests.
    if user.mess_owner_id and not any(row.owner_id == user.mess_owner_id for row in rows):
        owner = db.get(models.User, user.mess_owner_id)
        profile = db.get(models.MessProfile, user.mess_owner_id)
        invitation = db.get(models.JoinInvite, user.mess_owner_id)
        memberships.append({'owner_id': user.mess_owner_id,
            'mess_name': profile.name if profile and profile.name else f"{owner.name}’s mess",
            'join_token': invitation.token if invitation else None, 'status': 'approved', 'needs_plan': False})
    return memberships


@router.get('/owner/join-requests')
def requests(db: Session = Depends(get_db), owner=Depends(require_owner)):
    items = db.query(models.JoinRequest, models.User).join(models.User, models.User.id == models.JoinRequest.user_id).filter(models.JoinRequest.owner_id == owner.id, models.JoinRequest.status == 'pending').order_by(models.JoinRequest.id.desc()).all()
    result = []
    for r, u in items:
        selection = db.get(models.JoinSelection, r.id)
        offer = db.query(models.PlanOffer).filter_by(id=selection.offer_id).with_for_update().first() if selection else None
        result.append({'id': r.id, 'name': u.name, 'phone': u.phone, 'created_at': r.created_at,
                       'plan': {'name': offer.name, 'price': float(offer.price), 'meal_price': float(offer.meal_price),
                                'start_date': selection.start_date, 'end_date': selection.start_date + timedelta(days=offer.duration_days-1)} if offer else None})
    return result


class Decision(BaseModel):
    status: str = Field(pattern='^(approved|rejected)$')


@router.patch('/owner/join-requests/{request_id}')
def decide(request_id: int, body: Decision, db: Session = Depends(get_db), owner=Depends(require_owner)):
    item = db.query(models.JoinRequest).filter_by(id=request_id, owner_id=owner.id).with_for_update().first()
    if not item:
        raise HTTPException(404, 'Join request not found')
    if item.status != 'pending':
        raise HTTPException(409, 'This request has already been reviewed')
    if body.status == 'approved':
        selection = db.get(models.JoinSelection, item.id)
        if selection:
            offer = db.query(models.PlanOffer).filter_by(id=selection.offer_id).with_for_update().first()
            if not offer or not offer.active or selection.start_date < date.today():
                raise HTTPException(409, 'The selected plan is unavailable or its start date has passed. Ask the customer to reselect through your join link.')
            end = selection.start_date + timedelta(days=offer.duration_days-1)
            overlap = db.query(models.MealPlan).filter(models.MealPlan.user_id == item.user_id,
                models.MealPlan.status.in_(['active', 'pending_payment', 'pending_acceptance']),
                models.MealPlan.start_date <= end, models.MealPlan.end_date >= selection.start_date).first()
            if overlap:
                raise HTTPException(409, 'Customer already has a subscription for these dates')
            plan = models.MealPlan(user_id=item.user_id, offer_id=offer.id, purchase_key=str(uuid4()),
                meal_types=list(included_types(offer)), price=offer.price, meal_price=offer.meal_price,
                start_date=selection.start_date, end_date=end, status='pending_payment', plan_type=offer.name)
            db.add(plan)
            db.flush()
            db.add(models.IssuedBill(user_id=item.user_id, plan_id=plan.id, base_amount=offer.price,
                deductions=0, extras_total=0, final_amount=offer.price))
    item.status = body.status
    db.commit()
    message = 'Join request declined.'
    if body.status == 'approved':
        message = ('Customer approved. Their chosen subscription is awaiting full payment. A bill was generated.'
                   if selection else 'Customer approved. Ask them to choose a subscription in Plans & pause.')
    return {'message': message}
