from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator, field_validator
from typing import Literal
from sqlalchemy.orm import Session
from app import models
from app.database import get_db
from app.routes.owner_meal_routes import require_owner
from app.routes.join_routes import invite, find_invite
from app.tenancy import public_db

router = APIRouter(tags=['public mess page'])


class TimingInput(BaseModel):
    meal_type: Literal['breakfast', 'lunch', 'dinner']
    from_time: str = Field(pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    to_time: str = Field(pattern=r'^([01]\d|2[0-3]):[0-5]\d$')

    @model_validator(mode='after')
    def ordered(self):
        if self.to_time <= self.from_time:
            raise ValueError('Meal closing time must be after opening time')
        return self


class ProfileInput(BaseModel):
    name: str = Field(default='', max_length=100)
    address: str = Field(default='', max_length=500)
    contact: str = Field(default='', max_length=100)
    hours: str = Field(default='', max_length=300)
    about: str = Field(default='', max_length=2000)
    preparation: str = Field(default='', max_length=3000)

    timings: list[TimingInput] | None = Field(default=None, max_length=3)

    @field_validator('timings')
    @classmethod
    def distinct_meals(cls, value):
        if value and len({t.meal_type for t in value}) != len(value):
            raise ValueError('Each meal timing can only appear once')
        return value

    @field_validator('name', 'address', 'contact', 'hours', 'about', 'preparation')
    @classmethod
    def trim(cls, value):
        return value.strip()


def output(owner, db):
    profile = db.get(models.MessProfile, owner.id)
    data = {field: getattr(profile, field) or '' if profile else '' for field in ProfileInput.model_fields if field != 'timings'}
    data['name'] = data['name'] or f'{owner.name}’s mess'
    data['profile_saved'] = profile is not None
    data['timings'] = [{'meal_type': t.meal_type, 'from_time': t.from_time, 'to_time': t.to_time} for t in db.query(models.MealTiming).filter_by(owner_id=owner.id).order_by(models.MealTiming.from_time)]
    data['join_token'] = invite(db, owner)['token']
    return data


@router.get('/owner/mess-profile')
def owner_profile(db: Session = Depends(get_db), owner=Depends(require_owner)):
    return output(owner, db)


@router.put('/owner/mess-profile')
def save_profile(body: ProfileInput, db: Session = Depends(get_db), owner=Depends(require_owner)):
    item = db.get(models.MessProfile, owner.id)
    if not item:
        item = models.MessProfile(owner_id=owner.id)
        db.add(item)
    for field, value in body.model_dump(exclude={"timings"}).items():
        setattr(item, field, value)
    if body.timings is not None:
        db.query(models.MealTiming).filter_by(owner_id=owner.id).delete()
        for timing in body.timings:
            db.add(models.MealTiming(owner_id=owner.id, **timing.model_dump()))
        item.hours = '\n'.join(f'{t.meal_type.title()}: {t.from_time} – {t.to_time}' for t in body.timings)
    db.commit()
    return {'message': 'Mess details saved. Everyone can now see them on your public page.', **output(owner, db)}


@router.get('/public/mess')
def public_default(db: Session = Depends(public_db)):
    # public_db has selected the owner's mess before any profile is read.
    owner = db.query(models.User).join(models.MessProfile, models.MessProfile.owner_id == models.User.id).filter(models.User.role == 'owner', models.MessProfile.name != '').order_by(models.User.id.desc()).first()
    if not owner:
        owner = db.query(models.User).filter_by(role='owner').order_by(models.User.id.desc()).first()
    if not owner:
        raise HTTPException(404, 'The mess owner has not set up this page yet')
    return output(owner, db)


@router.get('/public/mess/{token}')
def public_profile(token: str, db: Session = Depends(public_db)):
    invitation = find_invite(token, db)
    return output(db.get(models.User, invitation.owner_id), db)


@router.get('/public/messes')
def mess_directory(db: Session = Depends(get_db)):
    owners = db.query(models.User).filter_by(role='owner').order_by(models.User.id).all()
    return [{'name': output(owner, db)['name'], 'join_token': invite(db, owner)['token']}
            for owner in owners]


class GuestPriceInput(BaseModel):
    price: Decimal = Field(ge=0, le=10000, max_digits=7, decimal_places=2)


@router.put('/owner/guest-price')
def save_guest_price(body: GuestPriceInput, db: Session = Depends(get_db), owner=Depends(require_owner)):
    setting = db.query(models.GuestPricing).first()
    if not setting:
        setting = models.GuestPricing(owner_id=owner.id)
        db.add(setting)
    setting.price = body.price
    db.commit()
    return {'price': float(setting.price), 'message': 'Guest price saved'}
