from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.meal_coverage import covers
from app.auth import get_current_user
from app.subscription_extensions import lock_customer, change_extension
from app.weekly_menu import sync_weekly_menu, weekly_menu_lock


router = APIRouter(prefix="/meals", tags=["meals"])


def ensure_not_dispatched(db, user_id, meal_id):
    if not lock_customer(db, user_id):
        raise HTTPException(404, "Customer not found")
    user = db.get(models.User, user_id)
    if not user or user.role != "customer":
        raise HTTPException(403, "Customer access required")
    meal = db.get(models.Meal, meal_id)
    if meal and not any(covers(p, meal) for p in db.query(models.MealPlan).filter(models.MealPlan.user_id == user_id, models.MealPlan.meal_id.is_(None), models.MealPlan.status == "active", models.MealPlan.start_date <= meal.date, models.MealPlan.end_date >= meal.date).all()):
        raise HTTPException(403, "An active subscription must cover this meal before you can skip it or add guests")
    delivery = db.query(models.DeliveryUpdate).filter_by(user_id=user_id, meal_id=meal_id).first()
    if delivery and delivery.status in ("out_for_delivery", "delivered"):
        raise HTTPException(400, "This meal has been dispatched. Meal changes are closed.")


def guest_price(db):
    setting = db.query(models.GuestPricing).first()
    return setting.price if setting else Decimal("50.00")


@router.get("/guest-price")
def get_guest_price(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return {"price": float(guest_price(db))}


# =========================================================
# GET TODAY'S MEALS
# =========================================================

@router.get("/today", response_model=list[schemas.MealOut])
def get_todays_meals(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    owner_id = db.info.get("mess_owner_id")
    with weekly_menu_lock(owner_id):
        sync_weekly_menu(db, owner_id)
        db.commit()
    meals = (
        db.query(models.Meal)
        .filter(models.Meal.date == date.today())
        .order_by(models.Meal.cutoff_time)
        .all()
    )

    orders = db.query(models.MealOrder).filter(models.MealOrder.user_id == current_user.id).all()
    statuses = {order.meal_id: order.status for order in orders}
    plans = db.query(models.MealPlan).filter_by(user_id=current_user.id, status="active").all()
    return [schemas.MealOut.model_validate(meal).model_copy(update={
        "status": statuses.get(meal.id, "confirmed"),
        "can_manage": any(p.meal_id is None and covers(p, meal) for p in plans),
        "booked": any(covers(p, meal) for p in plans),
    }) for meal in meals]


# =========================================================
# GET UPCOMING MEALS
# =========================================================

@router.get("/upcoming", response_model=list[schemas.MealOut])
def get_upcoming_meals(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    owner_id = db.info.get("mess_owner_id")
    with weekly_menu_lock(owner_id):
        sync_weekly_menu(db, owner_id)
        db.commit()
    meals = (
        db.query(models.Meal)
        .filter(models.Meal.date >= date.today())
        .order_by(models.Meal.date, models.Meal.cutoff_time)
        .all()
    )

    orders = db.query(models.MealOrder).filter(models.MealOrder.user_id == current_user.id).all()
    statuses = {order.meal_id: order.status for order in orders}
    plans = db.query(models.MealPlan).filter_by(user_id=current_user.id, status="active").all()
    return [schemas.MealOut.model_validate(meal).model_copy(update={
        "status": statuses.get(meal.id, "confirmed"),
        "can_manage": any(p.meal_id is None and covers(p, meal) for p in plans),
        "booked": any(covers(p, meal) for p in plans),
    }) for meal in meals]


# =========================================================
# SKIP MEAL
# =========================================================

@router.post("/skip")
def skip_meal(
    req: schemas.SkipMealRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ensure_not_dispatched(db, current_user.id, req.meal_id)
    from app.a_la_carte import guard_extras
    guard_extras(db, current_user.id, req.meal_id)
    # Find meal
    meal = (
        db.query(models.Meal)
        .filter(models.Meal.id == req.meal_id)
        .first()
    )

    if not meal:
        raise HTTPException(
            status_code=404,
            detail="Meal not found"
        )

    # Check cutoff time
    if meal.date < date.today() or (meal.cutoff_time and datetime.now(timezone.utc) >= meal.cutoff_time.replace(tzinfo=timezone.utc)):
        raise HTTPException(
            status_code=400,
            detail="Cutoff time has passed. You cannot skip this meal."
        )

    # Check existing order/action
    existing_order = (
        db.query(models.MealOrder)
        .filter(
            models.MealOrder.user_id == current_user.id,
            models.MealOrder.meal_id == req.meal_id,
        )
        .first()
    )

    if existing_order and existing_order.status == "guest_added":
        raise HTTPException(409, "Cannot skip a meal after adding guests")

    # User already skipped
    if existing_order and existing_order.status == "skipped":
        raise HTTPException(
            status_code=400,
            detail="You have already skipped this meal."
        )

    plan = next(p for p in db.query(models.MealPlan).filter(
        models.MealPlan.user_id == current_user.id, models.MealPlan.meal_id.is_(None),
        models.MealPlan.status == "active", models.MealPlan.start_date <= meal.date,
        models.MealPlan.end_date >= meal.date,
    ).with_for_update().all() if covers(p, meal))
    order = existing_order or models.MealOrder(user_id=current_user.id, meal_id=meal.id)
    order.status, order.extra_items, order.extra_cost = "skipped", None, 0
    order.extension_plan_id = plan.id
    order.extension_credit = True
    db.add(order)
    change_extension(db, plan, 1)
    db.commit()
    return {"message": "Meal skipped. One day added to your subscription.",
            "meal_id": meal.id, "status": "skipped", "skip_count": plan.skip_count,
            "end_date": plan.end_date}


# =========================================================
# UNDO SKIP
# =========================================================

@router.post("/undo-skip")
def undo_skip(
    req: schemas.SkipMealRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ensure_not_dispatched(db, current_user.id, req.meal_id)
    meal = (
        db.query(models.Meal)
        .filter(models.Meal.id == req.meal_id)
        .first()
    )

    if not meal:
        raise HTTPException(
            status_code=404,
            detail="Meal not found"
        )

    # Cannot undo after cutoff
    if meal.date < date.today() or (meal.cutoff_time and datetime.now(timezone.utc) >= meal.cutoff_time.replace(tzinfo=timezone.utc)):
        raise HTTPException(
            status_code=400,
            detail="Cutoff time has passed. You cannot undo this skip."
        )

    order = (
        db.query(models.MealOrder)
        .filter(
            models.MealOrder.user_id == current_user.id,
            models.MealOrder.meal_id == req.meal_id,
            models.MealOrder.status == "skipped",
        )
        .first()
    )

    if not order:
        raise HTTPException(
            status_code=404,
            detail="No skipped meal found."
        )

    if order.extension_plan_id:
        plan = db.get(models.MealPlan, order.extension_plan_id)
        paused_date = db.query(models.MealDatePause.id).filter_by(
            user_id=current_user.id, plan_id=plan.id, date=meal.date, active=True
        ).first()
        if order.extension_credit and not paused_date:
            change_extension(db, plan, -1)
        elif order.extension_credit and paused_date:
            remaining = db.query(models.MealOrder).join(
                models.Meal, models.MealOrder.meal_id == models.Meal.id
            ).filter(
                models.MealOrder.user_id == current_user.id,
                models.MealOrder.extension_plan_id == plan.id,
                models.MealOrder.status == "skipped",
                models.MealOrder.meal_id != meal.id,
                models.Meal.date == meal.date,
            ).all()
            if any(item.extension_credit for item in remaining):
                change_extension(db, plan, -1)
            elif remaining:
                remaining[0].extension_credit = True
            else:
                change_extension(db, plan, -1)
        order.extension_plan_id = None
        order.extension_credit = False
    order.status = "confirmed"

    db.commit()
    db.refresh(order)

    return {
        "message": "Meal skip cancelled successfully",
        "meal_id": req.meal_id,
        "status": "confirmed",
    }


# =========================================================
# ADD GUEST
# =========================================================

@router.post("/add-guest")
def add_guest(
    req: schemas.AddGuestRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ensure_not_dispatched(db, current_user.id, req.meal_id)
    # Find the meal
    meal = (
        db.query(models.Meal)
        .filter(models.Meal.id == req.meal_id)
        .first()
    )

    if not meal:
        raise HTTPException(
            status_code=404,
            detail="Meal not found"
        )

    # Check cutoff time
    if meal.date < date.today() or (meal.cutoff_time and datetime.now(timezone.utc) >= meal.cutoff_time.replace(tzinfo=timezone.utc)):
        raise HTTPException(
            status_code=400,
            detail="Cutoff time has passed, cannot add a guest"
        )

    # Check whether user already has an action for this meal
    existing_order = (
        db.query(models.MealOrder)
        .filter(
            models.MealOrder.user_id == current_user.id,
            models.MealOrder.meal_id == req.meal_id,
        )
        .first()
    )

    if existing_order and existing_order.status == "skipped":
        raise HTTPException(409, "Undo the skip before adding guests")

    # Prevent duplicate guest additions
    if existing_order and existing_order.status == "guest_added":
        raise HTTPException(
            status_code=400,
            detail="Guest already added for this meal"
        )

    if meal.single_price is None or meal.single_price <= 0:
        raise HTTPException(409, "Guest booking is unavailable until the owner sets this meal's single-meal price.")
    unit_price = meal.single_price
    if req.expected_unit_price is not None and Decimal(str(req.expected_unit_price)) != unit_price:
        raise HTTPException(409, "Guest price has changed. Refresh the page and confirm the new total.")
    total = unit_price * req.guest_count
    items = f"{req.guest_count} guest meal(s) at Rs {unit_price:.2f} each"

    # If another action exists, update the same row
    if existing_order:
        existing_order.status = "guest_added"
        existing_order.extra_items = items
        existing_order.guest_count = req.guest_count
        existing_order.extra_cost = total

        db.commit()
        db.refresh(existing_order)

        return {
            "message": "Guest added successfully",
            "meal_id": req.meal_id,
            "status": "guest_added"
        }

    # Otherwise create a new order
    order = models.MealOrder(
        user_id=current_user.id,
        meal_id=req.meal_id,
        status="guest_added",
        extra_items=items,
        guest_count=req.guest_count,
        extra_cost=total,
    )

    db.add(order)
    db.commit()
    db.refresh(order)

    return {
        "message": "Guest added successfully",
        "meal_id": req.meal_id,
        "status": "guest_added"
    }# =========================================================
# GET MY MEAL HISTORY
# =========================================================

@router.get("/history", response_model=list[schemas.MealOrderOut])
def get_meal_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    orders = (
        db.query(models.MealOrder)
        .filter(
            models.MealOrder.user_id == current_user.id
        )
        .order_by(models.MealOrder.id.desc())
        .all()
    )

    return orders
