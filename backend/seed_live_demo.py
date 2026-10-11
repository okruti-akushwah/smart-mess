"""Add one independent demonstration mess to the explicitly configured hosted database. Existing data is preserved."""
import os
import shutil
import sqlite3
from pathlib import Path
from datetime import datetime, timedelta, timezone
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
if os.environ.get('SEED_LIVE_DEMO') != 'YES':
    raise SystemExit('Set SEED_LIVE_DEMO=YES explicitly to add this demo mess.')
if not os.environ.get('DATABASE_URL'):
    raise SystemExit('DATABASE_URL must be explicitly set to the deployed backend database.')
from app.database import engine, SessionLocal
from app import models as m
from app.auth import hash_password
from sqlalchemy import inspect
if engine.dialect.name != 'postgresql' and os.environ.get('DEMO_SEED_TEST') != 'YES':
    raise SystemExit('Live demo requires a persistent PostgreSQL database.')
required = {'meal_plans': {'skip_count','accepted','original_end_date'}, 'meal_date_pauses': {'plan_id'}}
for table, columns in required.items():
    if not columns.issubset({column['name'] for column in inspect(engine).get_columns(table)}):
        raise SystemExit('Deploy the updated backend first to apply its schema migrations.')
with SessionLocal() as db:
    if db.query(m.User).filter(m.User.phone.like('91000000%')).first():
        raise SystemExit('Live demo accounts already exist or phone numbers are in use. No changes made.')

today = datetime.now(timezone(timedelta(hours=5, minutes=30))).date()
photos = ROOT / 'backend' / 'generated_menu_images'
photos.mkdir(exist_ok=True)
for dish in ['poha', 'paneer', 'dal', 'sabzi']:
    shutil.copyfile(ROOT / 'frontend' / 'src' / 'assets' / f'menu-{dish}.webp', photos / f'live-demo-{dish}.webp')

with SessionLocal() as db:
    def add(cls, **values):
        row = cls(**values)
        db.add(row)
        db.flush()
        return row
    password = hash_password('DemoKitchen#2026!')
    owner = add(m.User, phone='9100000001', name='Rajesh Kulkarni', role='owner', password_hash=password)
    oid = owner.id
    if not db.get(m.MessInstallation, 1):
        add(m.MessInstallation, id=1, owner_id=oid)
    add(m.JoinInvite, owner_id=oid, token=uuid4().hex)
    add(m.MessProfile, owner_id=oid, name='Annapurna Homestyle Kitchen',
        name_hi='अन्नपूर्णा होमस्टाइल किचन', address='24 College Road, near City Library, Pune',
        contact='Kitchen counter · 7:30 AM–9:00 PM',
        hours='Breakfast 7:30–9:30 · Lunch 12:00–14:30 · Dinner 19:00–21:00',
        about='Fresh vegetarian meals for students and working professionals, cooked daily with seasonal ingredients.',
        preparation='Vegetables prepared each morning. Dal cooked in small batches, rotis made fresh and meals packed before delivery.')
    for kind, start, end in [('breakfast','07:30','09:30'),('lunch','12:00','14:30'),('dinner','19:00','21:00')]:
        add(m.MealTiming, owner_id=oid, meal_type=kind, from_time=start, to_time=end)
    add(m.GuestPricing, owner_id=oid, price=90)
    add(m.PaymentSettings, owner_id=oid, payee_name='Annapurna Homestyle Kitchen', upi_id='',
        instructions='Demo account: payments and receipts shown here are sample records.')
    offers=[]
    for name, category, days, price, description in [
        ('A taste of home','regular',1,220,'Try one full day of breakfast, lunch and dinner.'),
        ('Weekly comfort','regular',7,1290,'Seven days of breakfast, lunch and dinner. Pause before cutoff when your plans change.'),
        ('Everyday homestyle','regular',30,4500,'Thirty days of all scheduled meals, rotating vegetarian menus and one extra day per skipped meal.'),
        ('Protein plus','protein',30,5700,'All scheduled meals for thirty days with extra paneer, lentils and chickpea dishes.')]:
        offers.append(add(m.PlanOffer, owner_id=oid, name=name, category=category, duration_days=days,
            price=price, meal_price=50, description=description, active=True))
    menus={
        'breakfast': [('Kanda poha, roasted peanuts, banana & masala chai','poha'),('Vegetable poha, seasonal fruit & ginger chai','poha'),('Indori poha, sev, pomegranate & chai','poha')],
        'lunch': [('Paneer butter masala, dal tadka, rice, roti & salad','paneer'),('Dal tadka, jeera rice, soft rotis, cucumber salad & pickle','dal'),('Seasonal vegetable sabzi, dal fry, rice, roti & raita','sabzi')],
        'dinner': [('Dal fry, jeera rice, phulkas & fresh salad','dal'),('Paneer curry, roti, rice & cucumber raita','paneer'),('Aloo gobi, dal tadka, rice, roti & salad','sabzi')]}
    meals={}
    for offset in range(-7,8):
        day=today+timedelta(days=offset)
        for kind, hour, price in [('breakfast',7,60),('lunch',11,100),('dinner',18,100)]:
            menu, photo=menus[kind][offset%3]
            cutoff=datetime.combine(day,datetime.min.time()).replace(hour=hour)-timedelta(hours=5,minutes=30)
            meals[offset,kind]=add(m.Meal, owner_id=oid, date=day, meal_type=kind,
                menu_description=menu, image_url=f'/menu-images/live-demo-{photo}.webp',
                cutoff_time=cutoff, single_price=price, is_complimentary=False)
    names=['Aarav Sharma','Priya Mehta','Rohan Desai','Sneha Patil','Kabir Shah','Ananya Rao',
           'Ishaan Joshi','Meera Nair','Dev Kulkarni','Nisha Singh','Arjun Verma','Tanvi Gupta','Aditya Menon']
    customers=[]
    plans=[]
    for i,name in enumerate(names):
        user=add(m.User, phone=f'91000000{i+2:02d}', name=name, role='customer',
            mess_owner_id=oid, password_hash=password)
        customers.append(user)
        add(m.JoinRequest, owner_id=oid, user_id=user.id, status='approved')
        add(m.DeliveryProfile, owner_id=oid, user_id=user.id,
            address=f'Room {201+i}, Campus Residency, College Road, Pune', instructions='Please leave at reception if I am in class.')
        if i>=10:
            continue
        skips=1 if i in [0,3,6] else 0
        start=today-timedelta(days=7)
        original_end=start+timedelta(days=29)
        plan=add(m.MealPlan, owner_id=oid, user_id=user.id, offer_id=offers[2].id,
            plan_type=offers[2].name, price=4500, meal_price=50, start_date=start,
            original_start_date=start, original_end_date=original_end,
            end_date=original_end+timedelta(days=skips), skip_count=skips, status='active')
        plans.append(plan)
        extras=90 if i in [1,5] else 0
        bill=add(m.IssuedBill, owner_id=oid, user_id=user.id, plan_id=plan.id,
            base_amount=4500, deductions=0, extras_total=extras, final_amount=4500+extras)
        amount=4500+extras if i%3==0 else 3000
        add(m.PaymentRecord, owner_id=oid, plan_id=plan.id, amount=amount,
            reference=f'DEMO-UPI-{today:%Y%m%d}-{i+1:03d}', receipt_key=uuid4().hex)
        if skips:
            add(m.MealOrder, owner_id=oid, user_id=user.id, meal_id=meals[-2,'dinner'].id,
                status='skipped', extension_plan_id=plan.id, guest_count=1, extra_cost=0)
        if extras:
            add(m.MealOrder, owner_id=oid, user_id=user.id, meal_id=meals[1,'lunch'].id,
                status='guest_added', guest_count=1, extra_cost=90, extra_items='One guest lunch')
        add(m.DeliveryUpdate, owner_id=oid, user_id=user.id, meal_id=meals[-1,'lunch'].id, status='delivered')
        if i<6:
            add(m.Feedback, owner_id=oid, user_id=user.id, meal_id=meals[-1,'lunch'].id,
                rating=4 if i==2 else 5, comment=[
                'Soft rotis and delicious dal. The portions are perfect.',
                'Loved the paneer today. Delivery arrived on time.',
                'Fresh food; a little less oil would be great.',
                'Feels like a home cooked lunch after a busy morning.',
                'The rotating menu keeps the week interesting.',
                'Good quality and convenient delivery to campus.'][i])
        if i==2:
            add(m.PaymentSubmission, owner_id=oid, user_id=user.id, bill_id=bill.id,
                amount=1500, method='upi', reference='DEMO-PAYMENT-AWAITING-REVIEW', status='pending')
    # Paid personal meal awaiting the owner's acceptance, plus an accepted trial order.
    for i,status,accepted,offset in [(10,'pending_acceptance',False,1),(11,'active',True,0)]:
        meal=meals[offset,'dinner']
        plan=add(m.MealPlan, owner_id=oid, user_id=customers[i].id, meal_id=meal.id,
            purchase_key=str(uuid4()), plan_type='Single dinner', price=100, meal_price=100,
            start_date=meal.date, end_date=meal.date, status=status, accepted=accepted)
        add(m.IssuedBill, owner_id=oid, user_id=customers[i].id, plan_id=plan.id,
            base_amount=100, deductions=0, extras_total=0, final_amount=100)
        add(m.PaymentRecord, owner_id=oid, plan_id=plan.id, amount=100,
            reference='DEMO-SINGLE-MEAL-UPI', receipt_key=uuid4().hex)
    db.commit()
    print('Live demo added: 1 owner, 13 customers, 45 menus, 4 offers, 10 subscriptions, 2 personal orders, 6 reviews.')
    print('Owner: 9100000001 | Subscribed customer: 9100000002 | No-subscription customer: 9100000014 | Password: DemoKitchen#2026!')

