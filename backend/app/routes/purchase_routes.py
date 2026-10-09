"""Address-first checkout, confirmed purchases and customer activity."""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app import models
from app.database import get_db
from app.routes.discovery_routes import customer
from app.routes.workflow_routes import bill_output

router = APIRouter(tags=["customer purchases"])


class CheckoutInput(BaseModel):
    offer_id: int | None = None
    meal_id: int | None = None
    start_date: date | None = None
    expected_price: Decimal = Field(gt=0, le=100000, max_digits=12, decimal_places=2)
    purchase_key: UUID

    @model_validator(mode="after")
    def one_choice(self):
        if (self.offer_id is None) == (self.meal_id is None):
            raise ValueError("Choose one subscription or one meal")
        if self.offer_id is not None and self.start_date is None:
            raise ValueError("Choose a subscription start date")
        return self


def purchase_output(plan, db):
    bill = db.query(models.IssuedBill).filter_by(plan_id=plan.id).order_by(models.IssuedBill.id.desc()).first()
    meal = db.get(models.Meal, plan.meal_id) if plan.meal_id else None
    return {**bill_output(bill, db), "status": plan.status, "offer_id": plan.offer_id,
            "meal_id": plan.meal_id, "name": plan.plan_type,
            "kind": "meal" if plan.meal_id else "subscription",
            "menu": meal.menu_description if meal else None,
            "image_url": meal.image_url if meal else None,
            "meal_type": meal.meal_type if meal else None}


@router.post("/customer/checkout", status_code=201)
def checkout(body: CheckoutInput, db: Session = Depends(get_db), user=Depends(customer)):
    # Serialize checkouts for this customer on databases supporting row locks.
    db.query(models.User).filter_by(id=user.id).with_for_update().first()
    profile = db.get(models.DeliveryProfile, user.id)
    if not profile or len(profile.address.strip()) < 10:
        raise HTTPException(409, "Add your delivery address before choosing a meal or plan")
    previous = db.query(models.MealPlan).filter_by(purchase_key=str(body.purchase_key)).first()
    if previous:
        if (previous.user_id != user.id or previous.offer_id != body.offer_id or previous.meal_id != body.meal_id
                or previous.price != body.expected_price or (body.offer_id and previous.start_date != body.start_date)):
            raise HTTPException(409, "Checkout key already used for a different purchase")
        return purchase_output(previous, db)
    if body.offer_id is not None:
        offer = db.get(models.PlanOffer, body.offer_id)
        if not offer or not offer.active:
            raise HTTPException(404, "Plan unavailable")
        if body.start_date < date.today():
            raise HTTPException(422, "Choose today or a future start date")
        start, end = body.start_date, body.start_date + timedelta(days=offer.duration_days - 1)
        price, deduction, name = offer.price, offer.meal_price, offer.name
        if db.query(models.PlanRequest).filter_by(user_id=user.id, status="pending").first():
            raise HTTPException(409, "Cancel your previous plan request before checking out")
    else:
        meal = db.get(models.Meal, body.meal_id)
        if not meal:
            raise HTTPException(404, "Meal unavailable")
        if meal.date < date.today() or (meal.cutoff_time and meal.cutoff_time.replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc)):
            raise HTTPException(409, "Ordering for this meal has closed")
        if not meal.single_price:
            raise HTTPException(409, "Your owner has not enabled single-meal ordering for this meal")
        start = end = meal.date
        price, deduction, name = meal.single_price, Decimal("0"), f"{meal.meal_type.title()} · {meal.menu_description}"
    if price != body.expected_price:
        raise HTTPException(409, "Price has changed. Refresh and confirm the new amount")
    overlaps = db.query(models.MealPlan).filter(models.MealPlan.user_id == user.id,
        models.MealPlan.status.in_(["active", "pending_payment"]),
        models.MealPlan.start_date <= end, models.MealPlan.end_date >= start).all()
    if any(body.offer_id is not None or p.meal_id is None or p.meal_id == body.meal_id for p in overlaps):
        raise HTTPException(409, "You already have a booking or checkout covering these dates. Continue payment from your history.")
    plan = models.MealPlan(user_id=user.id, offer_id=body.offer_id, meal_id=body.meal_id,
        purchase_key=str(body.purchase_key), plan_type=name, price=price, meal_price=deduction,
        start_date=start, end_date=end, status="pending_payment")
    try:
        db.add(plan)
        db.flush()
        db.add(models.IssuedBill(user_id=user.id, plan_id=plan.id, base_amount=price,
            deductions=0, extras_total=0, final_amount=price))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Checkout already exists. Open your history to continue payment.")
    return purchase_output(plan, db)


def activate_paid_purchase(plan, db):
    if plan.status != "pending_payment":
        return
    paid = sum((r.amount for r in db.query(models.PaymentRecord).filter_by(plan_id=plan.id)), Decimal("0"))
    if paid < plan.price:
        return
    plan.status = "active"
    if plan.meal_id and not db.query(models.MealOrder).filter_by(user_id=plan.user_id, meal_id=plan.meal_id).first():
        db.add(models.MealOrder(user_id=plan.user_id, meal_id=plan.meal_id, status="confirmed", extra_cost=0))


@router.delete("/customer/checkout/{plan_id}")
def cancel_checkout(plan_id: int, db: Session = Depends(get_db), user=Depends(customer)):
    plan = db.query(models.MealPlan).filter_by(id=plan_id, user_id=user.id).with_for_update().first()
    if not plan:
        raise HTTPException(404, "Checkout not found")
    bill = db.query(models.IssuedBill).filter_by(plan_id=plan.id).first()
    if plan.status != "pending_payment" or db.query(models.PaymentRecord).filter_by(plan_id=plan.id).first() or db.query(models.PaymentSubmission).filter_by(bill_id=bill.id, status="pending").first():
        raise HTTPException(409, "A paid purchase or payment awaiting confirmation cannot be cancelled here. Contact your owner.")
    plan.status = "cancelled"
    db.commit()
    return {"message": "Checkout cancelled"}


@router.get("/customer/activity")
def activity(db: Session = Depends(get_db), user=Depends(customer)):
    plans = db.query(models.MealPlan).filter_by(user_id=user.id).order_by(models.MealPlan.id.desc()).all()
    active = [p for p in plans if p.status == "active"]
    orders = {o.meal_id: o for o in db.query(models.MealOrder).filter_by(user_id=user.id)}
    deliveries = {d.meal_id: d for d in db.query(models.DeliveryUpdate).filter_by(user_id=user.id)}
    reviews = {f.meal_id: f for f in db.query(models.Feedback).filter_by(user_id=user.id)}
    from app.routes.discovery_routes import eligible
    reviewable = {m["id"] for m in eligible(db, user)}
    rows = []
    for meal in db.query(models.Meal).order_by(models.Meal.date.desc(), models.Meal.id.desc()):
        coverage = next((p for p in active if p.start_date <= meal.date <= p.end_date and (p.meal_id is None or p.meal_id == meal.id)), None)
        order, delivery, review = orders.get(meal.id), deliveries.get(meal.id), reviews.get(meal.id)
        if not coverage and not order:
            continue
        rows.append({"id": meal.id, "date": meal.date, "meal_type": meal.meal_type,
            "menu": meal.menu_description, "image_url": meal.image_url,
            "kind": "meal" if coverage and coverage.meal_id else "subscription",
            "status": "skipped" if order and order.status == "skipped" else delivery.status if delivery else "scheduled" if meal.date >= date.today() else "past meal",
            "extra_cost": float(order.extra_cost or 0) if order else 0,
            "rating": review.rating if review else None, "can_review": meal.id in reviewable})
    purchases = [purchase_output(p, db) for p in plans if db.query(models.IssuedBill).filter_by(plan_id=p.id).first()]
    receipts = [{"id": r.id, "plan_id": r.plan_id, "amount": float(r.amount), "reference": r.reference,
        "created_at": r.created_at} for r in db.query(models.PaymentRecord).filter(models.PaymentRecord.plan_id.in_([p.id for p in plans])).order_by(models.PaymentRecord.id.desc())]
    bill_plans = {b.id: b.plan_id for b in db.query(models.IssuedBill).filter_by(user_id=user.id)}
    submissions = [{"plan_id": bill_plans.get(s.bill_id), "id": s.id, "bill_id": s.bill_id, "amount": float(s.amount), "method": s.method,
        "status": s.status, "created_at": s.created_at} for s in db.query(models.PaymentSubmission).filter_by(user_id=user.id).order_by(models.PaymentSubmission.id.desc())]
    return {"meals": rows, "purchases": purchases, "receipts": receipts, "submissions": submissions}
