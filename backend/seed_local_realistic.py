"""Reset only the explicitly named local demo SQLite database."""
import os
import shutil
import sqlite3
from pathlib import Path
from datetime import datetime, timedelta, timezone
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'backend' / 'local-demo.db'
BACKUPS = ROOT / 'output' / 'local-demo-backups'
BACKUPS.mkdir(parents=True, exist_ok=True)
stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
if TARGET.exists():
    with sqlite3.connect(TARGET) as source, sqlite3.connect(BACKUPS / f'demo-{stamp}.db') as dest:
        source.backup(dest)
os.environ['DATABASE_URL'] = 'sqlite:///' + TARGET.as_posix()
os.environ['APP_ENV'] = 'development'
os.environ['RENDER'] = 'false'
from app.database import Base, engine, SessionLocal
from app import models as m
from app.auth import hash_password

from app.migrate import upgrade
from sqlalchemy import MetaData, text
upgrade(engine, allow_legacy_upgrade=True)
with engine.begin() as connection:
    connection.execute(text('PRAGMA defer_foreign_keys=ON'))
    existing = MetaData()
    existing.reflect(bind=connection)
    for table in reversed(existing.sorted_tables):
        if table.name != 'app_schema_revisions':
            connection.execute(table.delete())

today = datetime.now(timezone(timedelta(hours=5, minutes=30))).date()
photos = ROOT / 'backend' / 'generated_menu_images'
photos.mkdir(exist_ok=True)
for dish in ['poha', 'paneer', 'dal', 'sabzi']:
    shutil.copyfile(ROOT / 'frontend' / 'src' / 'assets' / f'menu-{dish}.webp', photos / f'local-demo-{dish}.webp')

with SessionLocal() as db:
    def add(cls, **values):
        row = cls(**values)
        db.add(row)
        db.flush()
        return row
    password = hash_password('Demo1234!')
    owner = add(m.User, phone='9000000001', name='Rajesh Kulkarni', role='owner', password_hash=password)
    oid = owner.id
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
                menu_description=menu, image_url=f'/menu-images/local-demo-{photo}.webp',
                cutoff_time=cutoff, single_price=price, is_complimentary=False)
    names=['Aarav Sharma','Priya Mehta','Rohan Desai','Sneha Patil','Kabir Shah','Ananya Rao',
           'Ishaan Joshi','Meera Nair','Dev Kulkarni','Nisha Singh','Arjun Verma','Tanvi Gupta']
    customers=[]
    plans=[]
    for i,name in enumerate(names):
        user=add(m.User, phone=f'90000000{i+2:02d}', name=name, role='customer',
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
    # Multiple independent kitchens, including a new kitchen with empty sections.
    for index, name, owner_name, city in [
        (2, 'Saffron Tiffin House', 'Neha Kapoor', 'Jaipur'),
        (3, 'Coastal Lunch Studio', 'Arun Nair', 'Bengaluru')]:
        other = add(m.User, phone=f'900000010{index}', name=owner_name, role='owner', password_hash=password)
        add(m.JoinInvite, owner_id=other.id, token=f'local-demo-kitchen-{index}')
        add(m.MessProfile, owner_id=other.id, name=name, owner_name=owner_name,
            city=city, area='University Road', address=f'{20+index} University Road, {city}',
            business_type='Tiffin and mess service', food_type='Pure vegetarian',
            service_type='Lunch and dinner', operating_days='Monday to Saturday',
            opening_time='10:00', closing_time='21:00', business_status='Active',
            tagline='Fresh food for your everyday routine',
            about='Seasonal vegetables, fresh rotis and generous portions prepared daily.')
        if index == 3:
            continue
        second_offer = add(m.PlanOffer, owner_id=other.id, name='Lunch at Saffron',
            category='regular', duration_days=7, price=700, meal_price=100,
            meal_types=['lunch'], description='Seven homestyle lunches with dal, roti, rice and sabzi.', active=True)
        add(m.PlanOffer, owner_id=other.id, name='Previous summer special',
            category='regular', duration_days=7, price=650, meal_price=90,
            description='Archived sample offer; should not be purchasable.', active=False)
        add(m.GuestPricing, owner_id=other.id, price=110)
        add(m.PaymentSettings, owner_id=other.id, payee_name=name,
            instructions='Sample payment records only. Do not send real money.')
        add(m.JoinRequest, owner_id=other.id, user_id=customers[0].id, status='approved')
        for user, state in [(customers[1], 'pending'), (customers[2], 'rejected')]:
            request = add(m.JoinRequest, owner_id=other.id, user_id=user.id, status=state)
            add(m.JoinSelection, owner_id=other.id, request_id=request.id,
                offer_id=second_offer.id, start_date=today+timedelta(days=1))
        for offset in range(-2, 8):
            for kind in ['lunch', 'dinner']:
                day=today+timedelta(days=offset)
                add(m.Meal, owner_id=other.id, date=day, meal_type=kind,
                    menu_description='Rajma, jeera rice, phulka, seasonal sabzi and salad',
                    image_url='/menu-images/local-demo-dal.webp', single_price=110,
                    cutoff_time=datetime.combine(day, datetime.min.time()).replace(hour=5 if kind=='lunch' else 12),
                    is_complimentary=False)
        cross_plan=add(m.MealPlan, owner_id=other.id, user_id=customers[0].id,
            offer_id=second_offer.id, plan_type=second_offer.name, price=700, meal_price=100,
            meal_types=['lunch'], start_date=today, end_date=today+timedelta(days=6),
            original_start_date=today, original_end_date=today+timedelta(days=6),
            status='active', accepted=True)
        add(m.IssuedBill, owner_id=other.id, user_id=customers[0].id, plan_id=cross_plan.id,
            base_amount=700, deductions=0, extras_total=0, final_amount=700)
        add(m.PaymentRecord, owner_id=other.id, plan_id=cross_plan.id, amount=700,
            reference='DEMO-CROSS-MESS', receipt_key=uuid4().hex)
    for index, state, start, end in [
        (20, 'expired', today-timedelta(days=40), today-timedelta(days=11)),
        (21, 'active', today+timedelta(days=3), today+timedelta(days=32)),
        (22, 'pending_payment', today, today+timedelta(days=29))]:
        user=add(m.User, phone=f'90000000{index}', name={20:'Vikram Sethi',21:'Aditi Menon',22:'Farhan Ali'}[index],
            role='customer', password_hash=password, mess_owner_id=oid)
        add(m.JoinRequest, owner_id=oid, user_id=user.id, status='approved')
        plan=add(m.MealPlan, owner_id=oid, user_id=user.id, offer_id=offers[2].id,
            plan_type=offers[2].name, price=4500, meal_price=50,
            start_date=start, end_date=end, original_start_date=start, original_end_date=end,
            status=state, accepted=state!='pending_payment')
        bill=add(m.IssuedBill, owner_id=oid, user_id=user.id, plan_id=plan.id,
            base_amount=4500, deductions=0, extras_total=0, final_amount=4500)
        if state=='pending_payment':
            add(m.PaymentSubmission, owner_id=oid, user_id=user.id, bill_id=bill.id,
                amount=4500, method='upi', reference='DEMO-REJECTED-PROOF', status='rejected')
    add(m.User, phone='9000000030', name='Kavya Iyer', role='customer', password_hash=password)
    for weekday in range(7):
        for kind in menus:
            menu, photo=menus[kind][weekday%3]
            add(m.WeeklyMenuEntry, owner_id=oid, weekday=weekday, meal_type=kind,
                menu_description=menu, image_url=f'/menu-images/local-demo-{photo}.webp',
                single_price=60 if kind=='breakfast' else 100, is_complimentary=False,
                cutoff_time={'breakfast':'01:30','lunch':'05:30','dinner':'12:30'}[kind])
    profile=db.get(m.MessProfile, oid)
    profile.owner_name=owner.name
    profile.city='Pune'
    profile.area='College Road'
    profile.food_type='Pure vegetarian'
    profile.business_type='Tiffin and mess service'
    profile.service_type='Breakfast, lunch and dinner'
    profile.operating_days='Monday to Sunday'
    profile.opening_time='07:30'
    profile.closing_time='21:00'
    profile.business_status='Active'
    for dish in ['Dal', 'Roti', 'Rice', 'Sabzi', 'Salad', 'Raita', 'Paneer', 'Poha']:
        add(m.MenuItem, owner_id=oid, key=dish.lower(), name=dish)
    for user, stage in [(customers[1], 'preparing'), (customers[2], 'out_for_delivery')]:
        add(m.DeliveryUpdate, owner_id=oid, user_id=user.id,
            meal_id=meals[0, 'dinner'].id, status=stage)
    # Persisted pause is applied by the normal meal synchronization flow.
    add(m.MealDatePause, owner_id=oid, user_id=customers[3].id, plan_id=plans[3].id,
        date=today+timedelta(days=2), active=True)
    meals[7, 'breakfast'].single_price=None
    db.commit()
    print('Local demo ready: 3 owners, 16 customers, multiple messes and subscription/payment edge cases.')
    print('Owner: 9000000001 | Customer: 9000000002 | Password: Demo1234!')

# Preserve the prior connection settings privately before switching the local app.
env_file=ROOT/'backend'/'.env'
if env_file.exists():
    shutil.copyfile(env_file, BACKUPS/f'backend-env-{stamp}.txt')
    content=env_file.read_text(encoding='utf-8')
else:
    content=''
lines=[line for line in content.splitlines() if not line.strip().startswith(('DATABASE_URL=', 'DATABASE_URL ='))]
lines.append('DATABASE_URL=sqlite:///'+TARGET.as_posix())
env_file.write_text('\n'.join(lines)+'\n',encoding='utf-8')
print('Local backend configured for backend/local-demo.db. Hosted connection preserved in a private backup.')
