"""Persist date intentions and apply them when a subscribed menu is published."""
from datetime import date, datetime, timezone
from app import models
from app.meal_coverage import covers
from app.subscription_extensions import lock_customer, change_extension


def has_skipped_meal_for_date(db, user_id, plan_id, meal_date):
    return db.query(models.MealOrder.id).join(
        models.Meal, models.MealOrder.meal_id == models.Meal.id
    ).filter(
        models.MealOrder.user_id == user_id,
        models.MealOrder.extension_plan_id == plan_id,
        models.MealOrder.status == "skipped",
        models.Meal.date == meal_date,
    ).first() is not None


def lock_mess(db):
    owner_id = db.info.get("mess_owner_id")
    if owner_id:
        db.query(models.User).filter_by(id=owner_id).with_for_update().first()


def apply_date_pauses(db, meal):
    if meal.date < date.today():
        return
    pauses = db.query(models.MealDatePause).filter_by(date=meal.date, active=True).order_by(
        models.MealDatePause.user_id).all()
    for pause in pauses:
        lock_customer(db, pause.user_id)
        plan = db.get(models.MealPlan, pause.plan_id)
        if not plan or plan.status != "active" or not covers(plan, meal):
            continue
        # A saved pause before a cutoff remains effective even if publishing happens later.
        if meal.cutoff_time and pause.created_at.replace(tzinfo=timezone.utc) >= meal.cutoff_time.replace(tzinfo=timezone.utc):
            continue
        order = db.query(models.MealOrder).filter_by(user_id=pause.user_id, meal_id=meal.id).first()
        if order and order.status in ("skipped", "guest_added"):
            continue
        delivery = db.query(models.DeliveryUpdate).filter_by(user_id=pause.user_id, meal_id=meal.id).first()
        if delivery and delivery.status in ("out_for_delivery", "delivered"):
            continue
        from app.a_la_carte import has_extras
        if has_extras(db, pause.user_id, meal.id):
            continue
        add_extension_day = not has_skipped_meal_for_date(db, pause.user_id, plan.id, meal.date)
        order = order or models.MealOrder(user_id=pause.user_id, meal_id=meal.id)
        order.status, order.extra_cost, order.extra_items = "skipped", 0, None
        order.extension_plan_id = plan.id
        order.extension_credit = add_extension_day
        db.add(order)
        if add_extension_day:
            change_extension(db, plan, 1)
        db.flush()
