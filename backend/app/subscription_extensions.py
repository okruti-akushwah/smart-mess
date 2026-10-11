"""New skips earn one subscription day; old financial deductions stay historical."""
from datetime import timedelta
from app import models


def lock_customer(db, user_id):
    db.query(models.User).filter_by(id=user_id).with_for_update().first()


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
