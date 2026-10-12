from datetime import date, datetime, timezone, timedelta
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from app.meal_coverage import covers
from app import models
from app.database import get_db
from app.routes.discovery_routes import customer
from app.routes.owner_meal_routes import require_owner

router = APIRouter(tags=["delivery"])


class AddressInput(BaseModel):
    address: str = Field(min_length=10, max_length=500)
    instructions: str = Field(default="", max_length=250)

    @field_validator("address")
    @classmethod
    def address_text(cls, value):
        if len(value.strip()) < 10:
            raise ValueError("Please provide a complete address")
        return value.strip()


@router.get("/delivery/address")
def address(db: Session = Depends(get_db), user=Depends(customer)):
    item = db.get(models.DeliveryProfile, user.id)
    return {"address": item.address if item else "", "instructions": item.instructions if item else ""}


@router.put("/delivery/address")
def save_address(body: AddressInput, db: Session = Depends(get_db), user=Depends(customer)):
    item = db.get(models.DeliveryProfile, user.id)
    if not item:
        item = models.DeliveryProfile(user_id=user.id)
        db.add(item)
    item.address = body.address
    item.instructions = body.instructions.strip()
    db.commit()
    return {"message": "Delivery address saved. Confirm delivery availability with your owner."}


def deliveries_for(day, db):
    plans = db.query(models.MealPlan).filter(models.MealPlan.status == "active", models.MealPlan.start_date <= day, models.MealPlan.end_date >= day).all()
    ids = {p.user_id for p in plans}
    if not ids:
        return []
    users = {u.id: u for u in db.query(models.User).filter(models.User.id.in_(ids)).all()}
    addresses = {p.user_id: p for p in db.query(models.DeliveryProfile).filter(models.DeliveryProfile.user_id.in_(ids)).all()}
    meals = db.query(models.Meal).filter_by(date=day).all()
    meal_ids = {m.id for m in meals}
    if not meal_ids:
        return []
    orders = {(o.user_id, o.meal_id): o for o in db.query(models.MealOrder).filter(models.MealOrder.user_id.in_(ids), models.MealOrder.meal_id.in_(meal_ids)).all()}
    updates = {(d.user_id, d.meal_id): d for d in db.query(models.DeliveryUpdate).filter(models.DeliveryUpdate.user_id.in_(ids), models.DeliveryUpdate.meal_id.in_(meal_ids)).all()}
    # The scoped session selects this mess's owner and serving times.
    owner = db.query(models.User).join(models.MessProfile, models.MessProfile.owner_id == models.User.id).filter(models.User.role == "owner", models.MessProfile.name != "").order_by(models.User.id.desc()).first()
    if not owner:
        owner = db.query(models.User).filter_by(role="owner").order_by(models.User.id.desc()).first()
    timings = {t.meal_type: t.to_time for t in db.query(models.MealTiming).filter_by(owner_id=owner.id).all()} if owner else {}
    rows = []
    for meal in meals:
        end = timings.get(meal.meal_type)
        serving_ends_at = datetime.combine(day, datetime.strptime(end, "%H:%M").time(), tzinfo=timezone(timedelta(hours=5, minutes=30))).isoformat() if end else None
        for user_id in sorted({p.user_id for p in plans if covers(p, meal)}):
            order = orders.get((user_id, meal.id))
            if order and order.status == "skipped":
                continue
            profile = addresses.get(user_id)
            update = updates.get((user_id, meal.id))
            rows.append({"user_id": user_id, "meal_id": meal.id, "name": users[user_id].name,
                "phone": users[user_id].phone, "menu": meal.menu_description, "meal_type": meal.meal_type,
                "address": profile.address if profile else "", "instructions": profile.instructions if profile else "",
                "guest": bool(order and order.status == "guest_added"),
                "serving_ends_at": serving_ends_at,
                "status": update.status if update else "not_dispatched", "updated_at": update.updated_at if update else None})
    return rows


@router.get("/owner/deliveries")
def owner_deliveries(day: date = None, db: Session = Depends(get_db), owner=Depends(require_owner)):
    return deliveries_for(day or date.today(), db)


@router.get("/delivery/status")
def my_deliveries(db: Session = Depends(get_db), user=Depends(customer)):
    # Keep addresses and other customers' details out of the customer response.
    return [{k: row[k] for k in ("meal_id", "menu", "meal_type", "status", "updated_at", "guest", "serving_ends_at")}
            for row in deliveries_for(date.today(), db) if row["user_id"] == user.id]


class DispatchInput(BaseModel):
    user_id: int
    meal_id: int
    status: Literal["preparing", "out_for_delivery", "delivered"]


@router.put("/owner/deliveries")
def dispatch(body: DispatchInput, db: Session = Depends(get_db), owner=Depends(require_owner)):
    row = next((r for r in deliveries_for(date.today(), db) if r["user_id"] == body.user_id and r["meal_id"] == body.meal_id), None)
    if not row:
        raise HTTPException(400, "Only today's subscribed, non-skipped meals can be dispatched")
    if not row["address"]:
        raise HTTPException(400, "Customer must save a delivery address first")
    item = db.query(models.DeliveryUpdate).filter_by(user_id=body.user_id, meal_id=body.meal_id).with_for_update().first()
    stages = {"not_dispatched": 0, "preparing": 1, "out_for_delivery": 2, "delivered": 3}
    if stages[body.status] < stages[row["status"]]:
        raise HTTPException(400, "Delivery status cannot move backwards")
    if not item:
        item = models.DeliveryUpdate(user_id=body.user_id, meal_id=body.meal_id)
        db.add(item)
    item.status = body.status
    item.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Delivery status updated"}
