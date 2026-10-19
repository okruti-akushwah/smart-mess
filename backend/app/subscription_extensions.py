"""New skips earn one subscription day; old financial deductions stay historical."""
from datetime import timedelta
from sqlalchemy import update
from app import models


def lock_customer(db, user_id, all_messes=False):
    # A no-op UPDATE obtains a row lock on PostgreSQL and a write reservation
    # on SQLite, where SELECT ... FOR UPDATE is ignored. All customer action
    # flows use this as their first database operation before checking state.
    return db.execute(
        update(models.User).where(models.User.id == user_id).values(id=models.User.id),
        execution_options={"synchronize_session": False, "all_messes": all_messes},
    ).rowcount == 1


def change_extension(db, plan, delta):
    plans = db.query(models.MealPlan).filter(
        models.MealPlan.user_id == plan.user_id,
        models.MealPlan.meal_id.is_(None),
        models.MealPlan.status.in_(["active", "pending_payment"]),
    ).order_by(models.MealPlan.start_date, models.MealPlan.id).with_for_update().all()
    for item in plans:
        item.original_start_date = item.original_start_date or item.start_date
        item.original_end_date = item.original_end_date or item.end_date
    plan.skip_count = max((plan.skip_count or 0) + delta, 0)
    previous_end = None
    for item in plans:
        duration = (item.original_end_date - item.original_start_date).days
        item.start_date = max(item.original_start_date, previous_end + timedelta(days=1)) if previous_end else item.original_start_date
        item.end_date = item.start_date + timedelta(days=duration + (item.skip_count or 0))
        previous_end = item.end_date
    # Later subscriptions can move when an earlier one earns days. Do not move
    # a confirmed extra order outside the booking the customer bought it for.
    from fastapi import HTTPException
    from app.meal_coverage import covers
    bookings = {item.id:item for item in plans}
    for order in db.query(models.ALaCarteOrder).filter(
            models.ALaCarteOrder.plan_id.in_(list(bookings)),
            models.ALaCarteOrder.status == 'confirmed').all():
        if not covers(bookings[order.plan_id], db.get(models.Meal, order.meal_id)):
            raise HTTPException(409, 'This change would move a booking with confirmed extras. Contact your owner.')
