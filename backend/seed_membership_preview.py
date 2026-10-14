"""Seed only the isolated membership preview, leaving other databases untouched."""
import os
from pathlib import Path
from datetime import datetime, timedelta, timezone

preview = Path(__file__).resolve().parent.parent / 'output' / 'membership-test.db'
os.environ['DATABASE_URL'] = 'sqlite:///' + preview.as_posix()
os.environ['SECRET_KEY'] = 'local-membership-preview-secret'
os.environ['APP_ENV'] = 'development'
from app.database import SessionLocal
from app import models, auth

with SessionLocal() as db:
    password_hash = auth.hash_password('Demo1234')
    owners = []
    for letter, phone in [('A', '9000000011'), ('B', '9000000012'), ('C', '9000000013')]:
        owner = db.query(models.User).filter_by(phone=phone).first()
        if not owner:
            owner = models.User(name=f'Mess {letter} owner', phone=phone, role='owner', password_hash=password_hash)
            db.add(owner)
            db.flush()
            db.add(models.MessProfile(owner_id=owner.id, name=f'Mess {letter}'))
            db.add(models.JoinInvite(owner_id=owner.id, token=f'membership-preview-mess-{letter.lower()}'))
        owners.append(owner)
        today = datetime.now(timezone(timedelta(hours=5, minutes=30))).date()
        for day in [today, today + timedelta(days=1)]:
            if not db.query(models.Meal).filter_by(owner_id=owner.id, date=day, meal_type='dinner').first():
                db.add(models.Meal(owner_id=owner.id, date=day, meal_type='dinner',
                    menu_description=f'Mess {letter}: dal, rice and roti', single_price=120,
                    is_complimentary=False))
    rahul = db.query(models.User).filter_by(phone='9000000002').first()
    if not rahul:
        rahul = models.User(name='Rahul', phone='9000000002', role='customer',
            password_hash=password_hash, mess_owner_id=owners[0].id)
        db.add(rahul)
        db.flush()
        for owner in owners[:2]:
            db.add(models.JoinRequest(owner_id=owner.id, user_id=rahul.id, status='approved'))
    db.commit()
print('Membership preview ready. Rahul: 9000000002; Mess C owner: 9000000013; password: Demo1234')
