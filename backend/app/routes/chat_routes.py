from datetime import datetime, timedelta, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_, func, case
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app import models
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(prefix='/chat', tags=['private messages'])


def participant(db, user, customer_id=None):
    owner_id = db.info['mess_owner_id']
    if user.role not in ('owner', 'customer'):
        raise HTTPException(403, 'Messaging is available to owners and customers only')
    if user.role == 'customer':
        if customer_id not in (None, user.id):
            raise HTTPException(403, 'You can only open your own conversation')
        customer_id = user.id
    member = db.query(models.User).filter_by(id=customer_id, role='customer').first()
    if not member:
        raise HTTPException(404, 'Customer not found in this mess')
    membership = db.query(models.JoinRequest).filter_by(owner_id=owner_id, user_id=member.id).first()
    if (membership and membership.status != 'approved') or (not membership and member.mess_owner_id != owner_id):
        raise HTTPException(403, 'Only approved mess members can send messages')
    return owner_id, member


def output(message):
    return {'id': message.id, 'body': message.body, 'from_owner': message.from_owner,
            'created_at': message.created_at.replace(tzinfo=timezone.utc).isoformat(),
            'read_at': message.read_at.replace(tzinfo=timezone.utc).isoformat() if message.read_at else None}


@router.get('/conversations')
def conversations(db: Session = Depends(get_db), user=Depends(get_current_user)):
    owner_id = db.info['mess_owner_id']
    if user.role == 'customer':
        _, member = participant(db, user)
        owner = db.get(models.User, owner_id)
        profile = db.query(models.MessProfile).filter_by(owner_id=owner_id).first()
        members = [(member.id, owner.name, profile.name if profile else '')]
    elif user.role == 'owner':
        approved = db.query(models.JoinRequest.user_id).filter_by(owner_id=owner_id, status='approved')
        any_membership = db.query(models.JoinRequest.user_id).filter_by(owner_id=owner_id)
        users = db.query(models.User).filter(models.User.role == 'customer', or_(
            models.User.id.in_(approved),
            (models.User.mess_owner_id == owner_id) & ~models.User.id.in_(any_membership)
        )).order_by(models.User.name, models.User.id).all()
        members = [(member.id, member.name, '') for member in users]
    else:
        raise HTTPException(403, 'Messaging is unavailable for this account')
    incoming_owner = user.role != 'owner'
    stats = {row.customer_id: row for row in db.query(
        models.ChatMessage.customer_id,
        func.max(models.ChatMessage.id).label('last_id'),
        func.max(case((models.ChatMessage.from_owner == incoming_owner, models.ChatMessage.id), else_=0)).label('last_incoming_id'),
        func.sum(case(((models.ChatMessage.from_owner == incoming_owner) & models.ChatMessage.read_at.is_(None), 1), else_=0)).label('unread'),
    ).filter(models.ChatMessage.owner_id == owner_id).group_by(models.ChatMessage.customer_id).all()}
    last_ids = [row.last_id for row in stats.values()]
    latest = {row.id: row for row in db.query(models.ChatMessage).filter(models.ChatMessage.id.in_(last_ids)).all()} if last_ids else {}
    result = []
    for customer_id, name, mess_name in members:
        stat = stats.get(customer_id)
        last = latest.get(stat.last_id) if stat else None
        result.append({'customer_id': customer_id, 'name': name, 'mess_name': mess_name,
                       'last_incoming_id': int(stat.last_incoming_id or 0) if stat else 0,
                       'unread': int(stat.unread or 0) if stat else 0,
                       'last_message': output(last) if last else None})
    return sorted(result, key=lambda item: (item['unread'] > 0, item['last_message']['id'] if item['last_message'] else 0), reverse=True)


@router.get('/messages')
def messages(customer_id: int | None = None, after_id: int = Query(0, ge=0), before_id: int | None = Query(None, gt=0),
             db: Session = Depends(get_db), user=Depends(get_current_user)):
    owner_id, member = participant(db, user, customer_id)
    query = db.query(models.ChatMessage).filter_by(owner_id=owner_id, customer_id=member.id)
    if before_id:
        query = query.filter(models.ChatMessage.id < before_id)
    elif after_id:
        query = query.filter(models.ChatMessage.id > after_id)
    rows = query.order_by(models.ChatMessage.id.asc() if after_id and not before_id else models.ChatMessage.id.desc()).limit(51).all()
    has_more = len(rows) > 50
    rows = rows[:50]
    return {'messages': [output(row) for row in sorted(rows, key=lambda row: row.id)], 'has_more': has_more}


class MessageInput(BaseModel):
    customer_id: int | None = None
    body: str = Field(min_length=1, max_length=2000)
    client_key: UUID

    @field_validator('body')
    @classmethod
    def clean(cls, value):
        value = value.strip()
        if not value:
            raise ValueError('Enter a message')
        return value


@router.post('/messages', status_code=201)
def send(body: MessageInput, db: Session = Depends(get_db), user=Depends(get_current_user)):
    owner_id, member = participant(db, user, body.customer_id)
    keys = dict(owner_id=owner_id, customer_id=member.id, from_owner=user.role == 'owner', client_key=str(body.client_key))
    existing = db.query(models.ChatMessage).filter_by(**keys).first()
    if existing:
        if existing.body != body.body:
            raise HTTPException(409, 'This message key was already used')
        return output(existing)
    count = db.query(func.count(models.ChatMessage.id)).filter(
        models.ChatMessage.owner_id == owner_id,
        models.ChatMessage.from_owner == (user.role == 'owner'),
        models.ChatMessage.created_at >= datetime.now(timezone.utc).replace(tzinfo=None)-timedelta(minutes=1),
    )
    if user.role == 'customer':
        count = count.filter(models.ChatMessage.customer_id == member.id)
    if count.scalar() >= 30:
        raise HTTPException(429, 'Too many messages. Please wait a minute.')
    message = models.ChatMessage(**keys, body=body.body)
    db.add(message)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        message = db.query(models.ChatMessage).filter_by(**keys).first()
        if not message or message.body != body.body:
            raise HTTPException(409, 'Message could not be saved. Please try again.') from None
    db.refresh(message)
    return output(message)


class ReadInput(BaseModel):
    customer_id: int | None = None
    last_message_id: int = Field(gt=0)


@router.patch('/read')
def mark_read(body: ReadInput, db: Session = Depends(get_db), user=Depends(get_current_user)):
    owner_id, member = participant(db, user, body.customer_id)
    rows = db.query(models.ChatMessage).filter(
        models.ChatMessage.owner_id == owner_id, models.ChatMessage.customer_id == member.id,
        models.ChatMessage.from_owner == (user.role != 'owner'), models.ChatMessage.read_at.is_(None),
        models.ChatMessage.id <= body.last_message_id).all()
    for row in rows:
        row.read_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    return {'read': len(rows)}
