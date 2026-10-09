"""Populate only backend/demo.db; reruns preserve existing demo actions."""
import os
from pathlib import Path
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

DEMO_DB = Path(__file__).resolve().parent / "demo.db"
os.environ["DATABASE_URL"] = "sqlite:///" + DEMO_DB.as_posix()
os.environ["SECRET_KEY"] = "local-demo-only-secret"
from app.database import Base, engine, SessionLocal
from app import models
from app.auth import hash_password
from app.migrations import add_menu_image_column, add_skip_deduction_column

Base.metadata.create_all(engine)
add_menu_image_column(engine)
add_skip_deduction_column(engine)
today = date.today()

with SessionLocal() as db:
    def account(phone, name, role):
        user = db.query(models.User).filter_by(phone=phone).first()
        if not user:
            user = models.User(phone=phone, name=name, role=role, password_hash=hash_password("Demo1234"))
            db.add(user); db.flush()
        return user

    owner = account("9000000001", "Demo Mess Owner", "owner")
    customer = account("9000000002", "Demo Customer", "customer")
    newcomer = account("9000000003", "Demo New Customer", "customer")
    offers = []
    for name, days, price in [("Demo one-day trial",1,150),("Demo weekly comfort",7,900),("Demo monthly homestyle",30,3000)]:
        offer = db.query(models.PlanOffer).filter_by(name=name).first()
        if not offer:
            offer = models.PlanOffer(name=name,category="regular",duration_days=days,price=price,meal_price=50,
                description="Demo plan: all scheduled meals during the subscription dates.",active=True)
            db.add(offer); db.flush()
        offers.append(offer)
    plan = db.query(models.MealPlan).filter_by(user_id=customer.id).first()
    if not plan:
        plan = models.MealPlan(user_id=customer.id,plan_type="Demo monthly homestyle",price=3000,meal_price=50,
            start_date=today-timedelta(days=2),end_date=today+timedelta(days=27),status="active")
        db.add(plan); db.flush()
    menus = [("breakfast","Poha, fresh fruit & masala chai"),("lunch","Paneer curry, dal, rice & soft rotis"),("dinner","Seasonal sabzi, dal tadka & jeera rice")]
    meals = {}
    for offset in range(-2,5):
        for kind, menu in menus:
            meal_day = today+timedelta(days=offset)
            meal = db.query(models.Meal).filter_by(date=meal_day,meal_type=kind).first()
            if not meal:
                meal = models.Meal(date=meal_day,meal_type=kind,menu_description=menu,is_complimentary=True,
                    cutoff_time=(datetime.now(timezone.utc)+timedelta(days=offset,hours=4)).replace(tzinfo=None))
                db.add(meal); db.flush()
            meals[offset,kind] = meal
    for kind, status, cost in [("breakfast","skipped",0),("lunch","guest_added",75)]:
        meal = meals[1,kind]
        if not db.query(models.MealOrder).filter_by(user_id=customer.id,meal_id=meal.id).first():
            db.add(models.MealOrder(user_id=customer.id,meal_id=meal.id,status=status,extra_cost=cost,
                extra_items="1 demo guest meal" if cost else None))
    if not db.get(models.DeliveryProfile,customer.id):
        db.add(models.DeliveryProfile(user_id=customer.id,address="Demo hostel, Room 201, Sample Road",instructions="Demo address only. Leave at reception."))
    if not db.query(models.DeliveryUpdate).filter_by(user_id=customer.id,meal_id=meals[0,"lunch"].id).first():
        db.add(models.DeliveryUpdate(user_id=customer.id,meal_id=meals[0,"lunch"].id,status="preparing"))
    if not db.query(models.PaymentRecord).filter_by(plan_id=plan.id).first():
        db.add(models.PaymentRecord(plan_id=plan.id,amount=1000,reference="DEMO: cash receipt, no real money received",receipt_key=str(uuid4())))
    if not db.get(models.PaymentSettings,1):
        db.add(models.PaymentSettings(id=1,payee_name="Demo Mess Owner",instructions="Demo only: cash collection at the mess counter, 6–8 pm. Upload your own QR to test scan payments."))
    if not db.query(models.Feedback).filter_by(user_id=customer.id,meal_id=meals[-1,"lunch"].id).first():
        db.add(models.Feedback(user_id=customer.id,meal_id=meals[-1,"lunch"].id,rating=5,comment="Demo review: loved the paneer and fresh rotis!"))
    if not db.query(models.PlanRequest).filter_by(user_id=newcomer.id).first():
        db.add(models.PlanRequest(user_id=newcomer.id,offer_id=offers[1].id,start_date=today,status="pending"))
    if not db.query(models.Bill).filter_by(user_id=customer.id).first():
        db.add(models.Bill(user_id=customer.id,month=(today.replace(day=1)-timedelta(days=1)).strftime("%Y-%m"),
            base_amount=3000,deductions=100,extras_total=50,final_amount=2950,payment_status="paid"))
    db.commit()
    print("Demo ready: 3 accounts, 21 meals, 3 offers, subscription, pending request, skip, guest, review, delivery and payment receipt.")
    print("All demo passwords: Demo1234. Real database unchanged.")
