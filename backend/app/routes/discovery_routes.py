from datetime import date, datetime, timedelta, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app import models, schemas
from app.auth import get_current_user
from app.database import get_db
from app.routes.owner_meal_routes import require_owner
from app.tenancy import public_db

router = APIRouter(tags=["menu, plans and reviews"])


def customer(user=Depends(get_current_user)):
    if user.role != "customer":
        raise HTTPException(403, "Customer access required")
    return user


class OfferInput(BaseModel):
    name: str = Field(min_length=3, max_length=80)
    category: Literal["regular", "mini", "protein", "special"] = "regular"
    duration_days: int = Field(ge=1, le=365)
    price: float = Field(gt=0, le=100000, allow_inf_nan=False)
    meal_price: float = Field(gt=0, le=10000, allow_inf_nan=False)
    description: str = Field(min_length=3, max_length=500)

    @field_validator("name", "description")
    @classmethod
    def clean(cls, value):
        if len(value.strip()) < 3:
            raise ValueError("Enter at least three non-space characters")
        return value.strip()


def offer_output(offer):
    return {"id": offer.id, "name": offer.name, "category": offer.category,
            "duration_days": offer.duration_days, "price": float(offer.price),
            "meal_price": float(offer.meal_price), "description": offer.description}


@router.get("/public/menu", response_model=list[schemas.MealOut])
def menu(db: Session = Depends(public_db)):
    return db.query(models.Meal).filter(models.Meal.date >= date.today(),
        models.Meal.date <= date.today() + timedelta(days=7)).order_by(models.Meal.date, models.Meal.cutoff_time).all()


@router.get("/public/plans")
def offers(db: Session = Depends(public_db)):
    return [offer_output(o) for o in db.query(models.PlanOffer).filter(models.PlanOffer.active.is_(True)).order_by(models.PlanOffer.duration_days, models.PlanOffer.price).all()]


def assigned_subscriptions(db, offer):
    # Legacy subscriptions stored a snapshot of the name rather than an offer ID.
    return db.query(models.MealPlan).filter(
        models.MealPlan.status.in_(["active", "pending_payment"]), models.MealPlan.end_date >= date.today(),
        or_(models.MealPlan.offer_id == offer.id,
            and_(models.MealPlan.offer_id.is_(None), models.MealPlan.plan_type == offer.name)))


@router.get("/owner/offers")
def owner_offers(db: Session = Depends(get_db), owner=Depends(require_owner)):
    return [{**offer_output(o), "assigned_count": assigned_subscriptions(db, o).count()}
            for o in db.query(models.PlanOffer).filter(models.PlanOffer.active.is_(True)).order_by(models.PlanOffer.id).all()]


@router.post("/owner/offers", status_code=201)
def create_offer(body: OfferInput, db: Session = Depends(get_db), owner=Depends(require_owner)):
    offer = models.PlanOffer(**body.model_dump())
    db.add(offer)
    db.commit()
    db.refresh(offer)
    return offer_output(offer)


@router.delete("/owner/offers/{offer_id}")
def archive_offer(offer_id: int, db: Session = Depends(get_db), owner=Depends(require_owner)):
    offer = db.query(models.PlanOffer).filter_by(id=offer_id).with_for_update().first()
    if not offer:
        raise HTTPException(404, "Plan not found")
    if assigned_subscriptions(db, offer).first():
        raise HTTPException(409, "Cannot unpublish this plan while it is assigned to a customer. Wait until their subscription ends or is cancelled.")
    offer.active = False
    db.commit()
    return {"message": "Plan removed from the catalogue"}


class RequestInput(BaseModel):
    offer_id: int
    start_date: date


@router.post("/subscriptions/requests", status_code=201)
def request_plan(body: RequestInput, db: Session = Depends(get_db), user=Depends(customer)):
    offer = db.get(models.PlanOffer, body.offer_id)
    if not offer or not offer.active:
        raise HTTPException(404, "Plan unavailable")
    if body.start_date < date.today():
        raise HTTPException(422, "Choose today or a future start date")
    end = body.start_date + timedelta(days=offer.duration_days - 1)
    if db.query(models.MealPlan).filter(models.MealPlan.user_id == user.id, models.MealPlan.status.in_(["active", "pending_payment"]), models.MealPlan.start_date <= end, models.MealPlan.end_date >= body.start_date).first():
        raise HTTPException(400, "You already have a subscription for these dates")
    if db.query(models.PlanRequest).filter_by(user_id=user.id, status="pending").first():
        raise HTTPException(400, "You already have a pending request. Cancel it before choosing another plan.")
    req = models.PlanRequest(user_id=user.id, **body.model_dump())
    db.add(req)
    db.commit()
    return {"message": "Plan requested. Your owner will confirm your subscription."}


def requests_output(rows, owner=False):
    return [{"id": r.id, "offer": offer_output(r.offer), "start_date": r.start_date,
             "status": r.status, **({"customer_name": r.user.name, "customer_phone": r.user.phone} if owner else {})} for r in rows]


@router.get("/subscriptions/requests")
def my_requests(db: Session = Depends(get_db), user=Depends(customer)):
    return requests_output(db.query(models.PlanRequest).filter_by(user_id=user.id).order_by(models.PlanRequest.id.desc()).all())


@router.get("/owner/requests")
def owner_requests(db: Session = Depends(get_db), owner=Depends(require_owner)):
    return requests_output(db.query(models.PlanRequest).filter_by(status="pending").order_by(models.PlanRequest.id).all(), True)


class Decision(BaseModel):
    status: Literal["approved", "rejected", "cancelled"]


@router.patch("/subscriptions/requests/{request_id}")
def decide(request_id: int, body: Decision, db: Session = Depends(get_db), user=Depends(get_current_user)):
    req = db.query(models.PlanRequest).filter_by(id=request_id).with_for_update().first()
    if not req or (user.role != "owner" and req.user_id != user.id):
        raise HTTPException(404, "Request not found")
    if user.role != "owner" and body.status != "cancelled":
        raise HTTPException(403, "Only your owner can approve a request")
    if req.status != "pending":
        raise HTTPException(400, "Request has already been processed")
    if body.status == "approved":
        offer = db.query(models.PlanOffer).filter_by(id=req.offer_id).with_for_update().first()
        if not offer or not offer.active or req.start_date < date.today():
            raise HTTPException(400, "Plan is unavailable or start date has passed. Ask the customer to submit a new request.")
        end = req.start_date + timedelta(days=req.offer.duration_days - 1)
        if db.query(models.MealPlan).filter(models.MealPlan.user_id == req.user_id, models.MealPlan.status.in_(["active", "pending_payment"]), models.MealPlan.start_date <= end, models.MealPlan.end_date >= req.start_date).first():
            raise HTTPException(400, "Customer already has a subscription for these dates")
        db.add(models.MealPlan(user_id=req.user_id, offer_id=req.offer_id, plan_type=req.offer.name, price=req.offer.price,
            meal_price=req.offer.meal_price, start_date=req.start_date, end_date=end, status="active"))
    req.status = body.status
    db.commit()
    return {"message": f"Request {body.status}"}


@router.get("/subscriptions/current")
def current_plan(db: Session = Depends(get_db), user=Depends(customer)):
    return [{"id": p.id, "name": p.plan_type, "price": float(p.price), "meal_price": float(p.meal_price),
             "start_date": p.start_date, "end_date": p.end_date} for p in db.query(models.MealPlan).filter(models.MealPlan.user_id == user.id, models.MealPlan.meal_id.is_(None), models.MealPlan.status == "active", models.MealPlan.end_date >= date.today()).order_by(models.MealPlan.start_date).all()]


class PauseInput(BaseModel):
    start_date: date
    end_date: date


def pause_result(body, db, user, apply=False):
    if body.start_date < date.today() or body.end_date < body.start_date or (body.end_date - body.start_date).days > 90:
        raise HTTPException(422, "Choose today or future dates, with the end on or after the start, up to 91 days")
    plans = db.query(models.MealPlan).filter(models.MealPlan.user_id == user.id, models.MealPlan.meal_id.is_(None), models.MealPlan.status == "active", models.MealPlan.start_date <= body.end_date, models.MealPlan.end_date >= body.start_date).all()
    if not plans:
        raise HTTPException(400, "No active subscription covers these dates. Choose dates within your subscription.")
    meals = db.query(models.Meal).filter(models.Meal.date >= body.start_date, models.Meal.date <= body.end_date).order_by(models.Meal.date, models.Meal.id).all()
    now = datetime.now(timezone.utc)
    eligible, unchanged = [], []
    for meal in meals:
        plan = next((p for p in plans if p.start_date <= meal.date <= p.end_date), None)
        delivery = db.query(models.DeliveryUpdate).filter_by(user_id=user.id, meal_id=meal.id).first()
        order = db.query(models.MealOrder).filter_by(user_id=user.id, meal_id=meal.id).first()
        reason = None
        if not plan:
            reason = "Outside subscription dates"
        elif order and order.status == "skipped":
            reason = "Already skipped"
        elif delivery and delivery.status in ("out_for_delivery", "delivered"):
            reason = "Already dispatched or delivered"
        elif meal.cutoff_time and meal.cutoff_time.replace(tzinfo=timezone.utc) <= now:
            reason = "Cutoff has passed"
        elif order and order.status == "guest_added":
            reason = "Guest booking exists"
        item = {"meal_id": meal.id, "date": meal.date, "meal_type": meal.meal_type, "menu_description": meal.menu_description}
        if reason:
            unchanged.append({**item, "reason": reason})
            continue
        eligible.append({**item, "deduction": float(plan.meal_price or 0)})
        if apply:
            if not order:
                order = models.MealOrder(user_id=user.id, meal_id=meal.id)
                db.add(order)
            order.status = "skipped"
            order.extra_cost = 0
            order.extra_items = None
    if apply:
        db.commit()
    if not meals:
        message = "No menus are published for these dates yet. Nothing was paused. Choose dates with published meals; menus added later are not automatically paused."
    elif not eligible:
        message = "No meals changed. All published meals in this range are already skipped or ineligible; see the reasons below."
    elif apply:
        message = f"Paused {len(eligible)} meal(s). Your bill and the owner's meal count have been updated."
    else:
        message = f"{len(eligible)} meal(s) can be paused."
    return {"message": message, "skipped": len(eligible) if apply else 0, "eligible_count": len(eligible), "meals": eligible, "unchanged": unchanged, "published_count": len(meals), "deductions": sum(item['deduction'] for item in eligible)}


@router.get("/subscriptions/pause-preview")
def preview_pause(start_date: date, end_date: date, db: Session = Depends(get_db), user=Depends(customer)):
    return pause_result(PauseInput(start_date=start_date, end_date=end_date), db, user)


@router.post("/subscriptions/pause")
def pause(body: PauseInput, db: Session = Depends(get_db), user=Depends(customer)):
    return pause_result(body, db, user, apply=True)


class ReviewInput(BaseModel):
    meal_id: int
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=500)


@router.get("/reviews/eligible")
def eligible(db: Session = Depends(get_db), user=Depends(customer)):
    plans = db.query(models.MealPlan).filter_by(user_id=user.id, status="active").all()
    deliveries = {d.meal_id: d for d in db.query(models.DeliveryUpdate).filter_by(user_id=user.id)}
    skipped = {o.meal_id for o in db.query(models.MealOrder).filter_by(user_id=user.id, status="skipped").all()}
    reviews = {f.meal_id: f for f in db.query(models.Feedback).filter_by(user_id=user.id).all()}
    meals = db.query(models.Meal).filter(models.Meal.date < date.today(), models.Meal.date >= date.today() - timedelta(days=60)).order_by(models.Meal.date.desc(), models.Meal.cutoff_time.desc(), models.Meal.id.desc()).all()
    def was_eaten(meal):
        covered = [p for p in plans if p.start_date <= meal.date <= p.end_date and (p.meal_id is None or p.meal_id == meal.id)]
        if not covered or meal.id in skipped:
            return False
        delivery = deliveries.get(meal.id)
        if delivery:
            return delivery.status == "delivered" and delivery.updated_at.replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=5, minutes=30))).date() < date.today()
        # Existing owner-assigned subscriptions may be served at the mess without dispatch tracking.
        return any(p.meal_id is None and not p.purchase_key for p in covered)
    return [{"id": m.id, "date": m.date, "menu": m.menu_description, "rating": reviews[m.id].rating if m.id in reviews else None,
             "comment": reviews[m.id].comment if m.id in reviews else "", "image_url": m.image_url, "meal_type": m.meal_type} for m in sorted(meals, key=lambda m: (m.date, {"breakfast": 0, "lunch": 1, "dinner": 2}.get(m.meal_type, 0)), reverse=True) if was_eaten(m)]


@router.post("/reviews")
def review(body: ReviewInput, db: Session = Depends(get_db), user=Depends(customer)):
    if body.meal_id not in {m["id"] for m in eligible(db, user)}:
        raise HTTPException(400, "You can review past meals covered by your subscription that you did not skip")
    item = db.query(models.Feedback).filter_by(user_id=user.id, meal_id=body.meal_id).first()
    if not item:
        item = models.Feedback(user_id=user.id, meal_id=body.meal_id)
        db.add(item)
    item.rating = body.rating
    item.comment = body.comment.strip()
    db.commit()
    return {"message": "Thank you! Your rating and suggestions have been sent to your mess owner."}


@router.get("/public/reviews")
def public_reviews(db: Session = Depends(public_db)):
    rows = db.query(models.Feedback, models.User.name, models.Meal.menu_description).join(models.User, models.User.id == models.Feedback.user_id).join(models.Meal, models.Meal.id == models.Feedback.meal_id).order_by(models.Feedback.id.desc()).limit(30).all()
    return [{"id": f.id, "name": name.split()[0] if name.split() else "Customer", "rating": f.rating, "comment": f.comment, "menu": menu} for f, name, menu in rows]


@router.get("/owner/reviews")
def owner_reviews(db: Session = Depends(get_db), owner=Depends(require_owner)):
    rows = db.query(models.Feedback, models.User, models.Meal).join(models.User, models.User.id == models.Feedback.user_id).join(models.Meal, models.Meal.id == models.Feedback.meal_id).order_by(models.Feedback.created_at.desc(), models.Feedback.id.desc()).limit(100).all()
    return [{"id": f.id, "name": u.name, "rating": f.rating, "comment": f.comment,
        "menu": m.menu_description, "image_url": m.image_url, "date": m.date,
        "meal_type": m.meal_type, "created_at": f.created_at} for f, u, m in rows]
