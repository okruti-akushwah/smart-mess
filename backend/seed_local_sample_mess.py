"""Add a sample mess to local-demo.db without resetting existing records."""
import os
from pathlib import Path
import sqlite3
from datetime import datetime, timedelta, timezone
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'backend' / 'local-demo.db'
if not TARGET.is_file():
    raise SystemExit('Expected local-demo.db does not exist; no changes made.')
os.environ['DATABASE_URL'] = 'sqlite:///' + TARGET.as_posix()
os.environ['RENDER'] = 'false'
from app.database import SessionLocal
from app import models as m
from app.auth import hash_password, verify_password

phones = ['9200000001', '9200000002', '9200000003']
password = 'LocalDemo123!'
today = datetime.now(timezone(timedelta(hours=5, minutes=30))).date()
backup_dir = ROOT / 'output' / 'local-demo-backups'
backup_dir.mkdir(parents=True, exist_ok=True)
backup = backup_dir / f'before-sample-mess-{datetime.now():%Y%m%d-%H%M%S}.db'
with sqlite3.connect(TARGET) as source, sqlite3.connect(backup) as destination:
    source.backup(destination)

with SessionLocal() as db:
    if db.query(m.User).filter(m.User.phone.in_(phones)).first():
        raise SystemExit('Sample phone numbers already exist; no records changed.')
    def add(cls, **values):
        row = cls(**values)
        db.add(row)
        db.flush()
        return row
    hashed = hash_password(password)
    owner = add(m.User, name='Meera Joshi', phone=phones[0], role='owner', password_hash=hashed)
    oid = owner.id
    add(m.JoinInvite, owner_id=oid, token=uuid4().hex)
    add(m.MessProfile, owner_id=oid, name='Saffron Home Kitchen',
        address='12 College Road, Pune (sample address)', contact='Local demo kitchen',
        hours='Breakfast 08:00–10:00 · Lunch 12:00–14:00 · Dinner 19:00–21:00',
        about='Sample vegetarian mess for testing subscriptions and single meals.',
        preparation='Fresh dal, seasonal vegetables and soft rotis prepared daily.')
    for kind, begin, end in [('breakfast', '08:00', '10:00'), ('lunch', '12:00', '14:00'), ('dinner', '19:00', '21:00')]:
        add(m.MealTiming, owner_id=oid, meal_type=kind, from_time=begin, to_time=end)
    add(m.GuestPricing, owner_id=oid, price=100)
    add(m.PaymentSettings, owner_id=oid, payee_name='Saffron Home Kitchen', upi_id='',
        instructions='Local sample only. Upload your own QR to test payment setup.')
    offers = []
    for name, days, price, types, description in [
        ('Weekly lunch', 7, 700, ['lunch'], 'Seven days of dal, rice, rotis and vegetables for lunch.'),
        ('Monthly homestyle', 30, 4500, ['breakfast', 'lunch', 'dinner'], 'Thirty days of breakfast, lunch and dinner.'),
        ('Weekly lunch & dinner', 7, 1400, ['lunch', 'dinner'], 'A full vegetarian lunch and dinner every day for one week.')]:
        offers.append(add(m.PlanOffer, owner_id=oid, name=name, category='regular',
            duration_days=days, price=price, meal_price=50, meal_types=types, description=description, active=True))
    for offset in range(7):
        day = today + timedelta(days=offset)
        for kind, hour, price, menu in [
            ('breakfast', 10, 60, 'Vegetable poha, fruit and chai'),
            ('lunch', 14, 100, 'Dal tadka, jeera rice, roti and salad'),
            ('dinner', 21, 100, 'Paneer curry, roti, rice and cucumber raita')]:
            cutoff = datetime.combine(day, datetime.min.time()).replace(hour=hour) - timedelta(hours=5, minutes=30)
            add(m.Meal, owner_id=oid, date=day, meal_type=kind, menu_description=menu,
                cutoff_time=cutoff, single_price=price, is_complimentary=False)
    customers = []
    for phone, name in [(phones[1], 'Aarav Patil'), (phones[2], 'Neha Shah')]:
        customer = add(m.User, name=name, phone=phone, role='customer', mess_owner_id=oid, password_hash=hashed)
        customers.append(customer)
        add(m.JoinRequest, owner_id=oid, user_id=customer.id, status='approved')
        add(m.DeliveryProfile, owner_id=oid, user_id=customer.id,
            address='Room 101, College Residency, Pune (sample address)', instructions='Local testing only')
    offer = offers[1]
    end = today + timedelta(days=29)
    plan = add(m.MealPlan, owner_id=oid, user_id=customers[0].id, offer_id=offer.id,
        plan_type=offer.name, price=offer.price, meal_price=offer.meal_price, meal_types=offer.meal_types,
        start_date=today, end_date=end, original_start_date=today, original_end_date=end,
        status='active', accepted=True, skip_count=0)
    add(m.IssuedBill, owner_id=oid, user_id=customers[0].id, plan_id=plan.id,
        base_amount=4500, deductions=0, extras_total=0, final_amount=4500)
    add(m.PaymentRecord, owner_id=oid, plan_id=plan.id, amount=4500,
        reference='LOCAL-SAMPLE-UPI-RECEIVED', receipt_key=uuid4().hex)
    db.commit()

with SessionLocal() as db:
    for phone in phones:
        user = db.query(m.User).filter_by(phone=phone).one()
        assert verify_password(password, user.password_hash)
    assert db.query(m.Meal).filter_by(owner_id=oid).count() == 21
    assert db.query(m.PlanOffer).filter_by(owner_id=oid).count() == 3
    subscribed_id = db.query(m.User).filter_by(phone=phones[1]).one().id
    unsubscribed_id = db.query(m.User).filter_by(phone=phones[2]).one().id
    assert db.query(m.MealPlan).filter_by(user_id=subscribed_id).count() == 1
    assert db.query(m.MealPlan).filter_by(user_id=unsubscribed_id).count() == 0
print(f'Added Saffron Home Kitchen with 21 meals and 3 offers. Subscription: {today} to {end}.')
print(f'Local database: {TARGET}')
print(f'Backup: {backup}')
print('Owner: 9200000001 | Subscribed customer: 9200000002 | No-subscription customer: 9200000003')
print(f'Password for all three: {password}')
