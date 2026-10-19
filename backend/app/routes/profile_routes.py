from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator, field_validator
from typing import Literal
from sqlalchemy.orm import Session
from app import models
from app.database import get_db
from app.routes.owner_meal_routes import require_owner
from app.routes.join_routes import invite, find_invite
from app.tenancy import public_db
from app.routes.discovery_routes import customer

BUSINESS_FIELDS = {'tagline', 'business_type', 'operating_days', 'opening_time', 'city', 'food_type', 'service_type', 'owner_name', 'closing_time', 'area', 'business_status', 'fssai_number'}

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
    latitude: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    longitude: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)

    @model_validator(mode='after')
    def coordinate_pair(self):
        supplied = {'latitude', 'longitude'} & self.model_fields_set
        if supplied and (len(supplied) != 2 or (self.latitude is None) != (self.longitude is None)):
            raise ValueError('Provide both latitude and longitude, or clear both')
        return self

    owner_name: str = Field(default='', max_length=100)
    business_type: str = Field(default='', max_length=100)
    tagline: str = Field(default='', max_length=150)
    food_type: str = Field(default='', max_length=100)
    service_type: str = Field(default='', max_length=100)
    operating_days: str = Field(default='', max_length=100)
    opening_time: str = Field(default='', pattern=r'^$|^([01]\d|2[0-3]):[0-5]\d$')
    closing_time: str = Field(default='', pattern=r'^$|^([01]\d|2[0-3]):[0-5]\d$')
    city: str = Field(default='', max_length=100)
    area: str = Field(default='', max_length=100)
    fssai_number: str = Field(default='', pattern=r'^$|^[0-9]{14}$')
    business_status: Literal['', 'Active', 'Temporarily closed', 'Closed'] = ''

    name_hi: str = Field(default="", max_length=100)
    about_hi: str = Field(default="", max_length=2000)
    preparation_hi: str = Field(default="", max_length=3000)
    address_hi: str = Field(default="", max_length=500)
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

    @field_validator('name', 'address', 'contact', 'hours', 'about', 'preparation', 'name_hi', 'about_hi', 'preparation_hi', 'address_hi', 'owner_name', 'business_type', 'tagline', 'food_type', 'service_type', 'operating_days', 'city', 'area')
    @classmethod
    def trim(cls, value):
        return value.strip()


def output(owner, db):
    profile = db.get(models.MessProfile, owner.id)
    data = {field: getattr(profile, field) or '' if profile else '' for field in ProfileInput.model_fields if field not in ('timings', 'latitude', 'longitude')}
    data.update({field: getattr(profile, field) if profile else None for field in ('latitude', 'longitude')})
    data['name'] = data['name'] or f'{owner.name}’s mess'
    data['owner_id'] = owner.id
    data['profile_saved'] = profile is not None
    data['timings'] = [{'meal_type': t.meal_type, 'from_time': t.from_time, 'to_time': t.to_time} for t in db.query(models.MealTiming).filter_by(owner_id=owner.id).order_by(models.MealTiming.from_time)]
    data['join_token'] = invite(db, owner)['token']
    return data


@router.get('/owner/mess-profile')
def owner_profile(db: Session = Depends(get_db), owner=Depends(require_owner)):
    data = output(owner, db)
    data['owner_name'] = data['owner_name'] or owner.name
    return data


@router.put('/owner/mess-profile')
def save_profile(body: ProfileInput, db: Session = Depends(get_db), owner=Depends(require_owner)):
    item = db.get(models.MessProfile, owner.id)
    if not item:
        item = models.MessProfile(owner_id=owner.id)
        db.add(item)
    for field, value in body.model_dump(exclude={"timings"}).items():
        if (field.endswith("_hi") or field in BUSINESS_FIELDS or field in ('latitude', 'longitude')) and field not in body.model_fields_set:
            continue
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
def mess_directory(db: Session = Depends(get_db),
                   latitude: float | None = Query(default=None, ge=-90, le=90, allow_inf_nan=False),
                   longitude: float | None = Query(default=None, ge=-180, le=180, allow_inf_nan=False),
                   radius_km: int | None = Query(default=None)):
    if radius_km is not None and radius_km not in (4, 10):
        raise HTTPException(422, 'Choose a 4 km or 10 km radius')
    if (latitude is None) != (longitude is None) or (radius_km is not None and latitude is None):
        raise HTTPException(422, 'Provide both coordinates to search by distance')
    def rows():
        return db.query(models.User.id, models.User.name, models.MessProfile.name.label('mess_name'),
            models.MessProfile.name_hi, models.MessProfile.city, models.MessProfile.area,
            models.MessProfile.food_type, models.MessProfile.service_type,
            models.MessProfile.latitude, models.MessProfile.longitude,
            models.JoinInvite.token).outerjoin(
            models.MessProfile, models.MessProfile.owner_id == models.User.id).outerjoin(
            models.JoinInvite, models.JoinInvite.owner_id == models.User.id).filter(
            models.User.role == 'owner').order_by(models.User.id).all()
    owners = rows()
    missing = [row for row in owners if not row.token]
    if missing:
        # Legacy owners may predate invitations. Create these once, as a batch.
        import secrets
        from sqlalchemy.exc import IntegrityError
        db.add_all(models.JoinInvite(owner_id=row.id, token=secrets.token_urlsafe(24)) for row in missing)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()  # Another request may have created the same invitation.
        owners = rows()
    from app.locations import distance_km
    result = [{'name': row.mess_name or f'{row.name}’s mess', 'name_hi': row.name_hi or '',
             'join_token': row.token, 'city': row.city or '', 'area': row.area or '',
             'food_type': row.food_type or '', 'service_type': row.service_type or '',
             'distance_km': distance_km(latitude, longitude, row.latitude, row.longitude)
                 if latitude is not None and row.latitude is not None and row.longitude is not None else None}
            for row in owners if row.token]
    if radius_km is not None:
        result = [row for row in result if row['distance_km'] is not None and row['distance_km'] <= radius_km]
    if latitude is not None:
        result.sort(key=lambda row: row['distance_km'] if row['distance_km'] is not None else float('inf'))
    return result


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


@router.get('/customer/account')
def customer_account(db: Session = Depends(get_db), user=Depends(customer)):
    from datetime import date
    owner = db.get(models.User, db.info['mess_owner_id'])
    profile = db.get(models.MessProfile, owner.id)
    pauses = db.query(models.MealDatePause).filter(
        models.MealDatePause.user_id == user.id,
        models.MealDatePause.active.is_(True),
        models.MealDatePause.date >= date.today()).order_by(models.MealDatePause.date).all()
    return {'customer_name': user.name,
            'mess_name': profile.name if profile and profile.name else f'{owner.name}’s mess',
            'mess_name_hi': profile.name_hi if profile else '',
            'contact': profile.contact if profile else '',
            'address': profile.address if profile else '',
            'paused_dates': [item.date.isoformat() for item in pauses]}
