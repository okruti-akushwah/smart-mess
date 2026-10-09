"""Add repeatable presentation fixtures to preview.db only (never the configured DB)."""
import os
import shutil
import sqlite3
from pathlib import Path
from datetime import datetime, timedelta, timezone

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'preview.db'
backup = ROOT / 'output' / ('preview-before-presentation-' + datetime.now().strftime('%Y%m%d-%H%M%S') + '.db')
backup.parent.mkdir(exist_ok=True)
with sqlite3.connect(TARGET) as source, sqlite3.connect(backup) as dest:
    source.backup(dest)
os.environ['DATABASE_URL'] = 'sqlite:///' + TARGET.as_posix()
from app.database import SessionLocal
from app import models as m
from app.auth import hash_password

today = datetime.now(timezone(timedelta(hours=5, minutes=30))).date()
photos = ROOT / 'backend' / 'generated_menu_images'
photos.mkdir(exist_ok=True)
for dish in ['poha', 'paneer', 'dal', 'sabzi']:
    shutil.copyfile(ROOT / 'frontend' / 'src' / 'assets' / f'menu-{dish}.webp', photos / f'presentation-{dish}.webp')

with SessionLocal() as db:
    def ensure(cls, keys, **values):
        row = db.query(cls).filter_by(**keys).first()
        if not row:
            row = cls(**keys, **values)
            db.add(row)
            db.flush()
        return row

    install = db.get(m.MessInstallation, 1)
    owner = db.get(m.User, install.owner_id) if install else db.query(m.User).filter_by(role='owner').first()
    if not owner:
        owner = ensure(m.User, {'phone': '9000000001'}, name='Annapurna Kitchen', role='owner', password_hash=hash_password('Demo1234'))
        db.add(m.MessInstallation(id=1, owner_id=owner.id))
    profile = ensure(m.MessProfile, {'owner_id': owner.id})
    details = dict(name='Annapurna Homestyle Kitchen', address='24, College Road, near City Library, Pune', contact='Ask at the kitchen counter',
        hours='Breakfast 7:30–9:30 · Lunch 12:00–14:30 · Dinner 19:00–21:00',
        about='Fresh, comforting vegetarian meals for students and working professionals. Seasonal vegetables, soft rotis and a rotating menu, prepared every day in our neighbourhood kitchen.',
        preparation='Vegetables prepped every morning. Dal slow-cooked in small batches. Rotis made fresh before service; meals packed just before delivery.')
    for key, value in details.items():
        if not getattr(profile, key):
            setattr(profile, key, value)
    for kind, start, end in [('breakfast','07:30','09:30'),('lunch','12:00','14:30'),('dinner','19:00','21:00')]:
        ensure(m.MealTiming, {'owner_id':owner.id,'meal_type':kind}, from_time=start, to_time=end)
    offers = []
    for name, category, days, price, description in [
        ('A taste of home','regular',1,180,'Try a full day of homestyle breakfast, lunch and dinner.'),
        ('Weekly comfort','regular',7,1190,'Seven days of fresh vegetarian meals. Perfect for a busy week.'),
        ('Everyday homestyle','regular',30,4200,'Our monthly favourite: all scheduled meals, a rotating menu and flexible skips before cutoff.'),
        ('Protein plus','protein',30,5400,'Paneer, lentils and chickpea dishes across a balanced vegetarian menu.')]:
        offers.append(ensure(m.PlanOffer, {'name':name}, category=category,duration_days=days,price=price,meal_price=60,description=description,active=True))
    breakfasts=['Kanda poha, roasted peanuts, banana & masala chai','Vegetable poha, fresh fruit & ginger chai','Indori poha, sev, pomegranate & chai']
    lunches=[('Paneer butter masala, dal tadka, steamed rice, roti & salad','paneer'),('Dal tadka, jeera rice, soft rotis, cucumber salad & pickle','dal'),('Seasonal vegetable sabzi, dal fry, rice, roti & raita','sabzi')]
    dinners=[('Dal fry, jeera rice, phulkas & fresh salad','dal'),('Paneer curry, roti, rice & cucumber raita','paneer'),('Aloo gobi, dal tadka, rice, roti & salad','sabzi')]
    meals={}
    for offset in range(-7,8):
        day=today+timedelta(days=offset)
        for kind, menu, photo, hour in [('breakfast',breakfasts[offset%3],'poha',7),('lunch',*lunches[offset%3],11),('dinner',*dinners[offset%3],18)]:
            cutoff=datetime.combine(day,datetime.min.time()).replace(hour=hour)-timedelta(hours=5,minutes=30)
            meal=ensure(m.Meal, {'date':day,'meal_type':kind},menu_description=menu,cutoff_time=cutoff,is_complimentary=True)
            if not meal.image_url:
                meal.image_url=f'/menu-images/presentation-{photo}.webp'
            meals[offset,kind]=meal
    names=['Aarav Sharma','Priya Mehta','Rohan Desai','Sneha Patil','Kabir Shah','Ananya Rao','Ishaan Joshi','Meera Nair','Dev Kulkarni','Nisha Singh','Arjun Verma','Tanvi Gupta']
    comments=['The dal tastes just like home and the rotis are always soft.','Really convenient during busy college weeks. Loved the paneer!','Fresh food, generous portions and a different menu every day.','The poha is my favourite breakfast. Light and freshly made.','Easy to pause meals when I am away for the weekend.','Simple, comforting dinners after a long day at work.']
    for i,name in enumerate(names):
        user=ensure(m.User, {'phone':f'900008{i:04d}'},name=name,role='customer',password_hash=hash_password('Demo1234'))
        ensure(m.JoinRequest, {'user_id':user.id},owner_id=owner.id,status='approved')
        plan=ensure(m.MealPlan, {'user_id':user.id,'plan_type':'Presentation monthly'},price=4200,meal_price=60,start_date=today-timedelta(days=7),end_date=today+timedelta(days=22),status='active')
        ensure(m.DeliveryProfile, {'user_id':user.id},address=f'Room {201+i}, Campus Residency, College Road',instructions='Please leave at the reception desk.')
        ensure(m.PaymentRecord, {'receipt_key':f'presentation-receipt-{i}'},plan_id=plan.id,amount=4200 if i%3==0 else 2500,reference='Presentation sample receipt — no real payment')
        if i<6:
            meal=meals[-1-i,'breakfast' if i==3 else 'lunch']
            ensure(m.Feedback, {'user_id':user.id,'meal_id':meal.id},rating=4 if i==2 else 5,comment=comments[i])
        ensure(m.DeliveryUpdate, {'user_id':user.id,'meal_id':meals[0,'lunch'].id},status=['preparing','out_for_delivery','delivered'][i%3])
        if i%4==0:
            ensure(m.MealOrder, {'user_id':user.id,'meal_id':meals[1,'dinner'].id},status='skipped',extra_cost=0)
        if i%5==0:
            ensure(m.MealOrder, {'user_id':user.id,'meal_id':meals[1,'lunch'].id},status='guest_added',extra_cost=60,guest_count=1,extra_items='One guest lunch')
    db.commit()
    print(f'Presentation ready: {len(meals)} meals with local photos, 4 offers, 12 sample subscribers, 6 reviews, delivery and payment activity.')
    print(f'Backup: {backup}')
    print('Sample customer: 9000080000 / Demo1234')
