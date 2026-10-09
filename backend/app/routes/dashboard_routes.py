from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app import auth, models
from app.database import get_db

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/headcount")
def get_tomorrow_headcount(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Count active subscribers expected for each meal tomorrow, after skips and guests."""
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")

    tomorrow = date.today() + timedelta(days=1)
    meals = db.query(models.Meal).filter(models.Meal.date == tomorrow).order_by(models.Meal.meal_type).all()
    if not meals:
        return {"date": tomorrow.isoformat(), "meals": []}

    active_plans = (
        db.query(models.MealPlan)
        .filter(
            models.MealPlan.status == "active",
            models.MealPlan.start_date <= tomorrow,
            models.MealPlan.end_date >= tomorrow,
        )
        .all()
    )
    subscriber_ids = {plan.user_id for plan in active_plans}
    result = []

    for meal in meals:
        subscriber_ids = {p.user_id for p in active_plans if p.meal_id is None or p.meal_id == meal.id}
        skipped_ids = set()
        guest_count = 0
        if subscriber_ids:
            skipped_ids = {
                user_id
                for (user_id,) in (
                    db.query(models.MealOrder.user_id)
                    .filter(
                        models.MealOrder.meal_id == meal.id,
                        models.MealOrder.status == "skipped",
                        models.MealOrder.user_id.in_(subscriber_ids),
                    )
                    .distinct()
                    .all()
                )
            }
            guest_count = (
                db.query(func.coalesce(func.sum(models.MealOrder.guest_count), 0))
                .filter(
                    models.MealOrder.meal_id == meal.id,
                    models.MealOrder.status == "guest_added",
                    models.MealOrder.user_id.in_(subscriber_ids),
                )
                .scalar()
            )

        active_subscribers = len(subscriber_ids)
        skipped_subscribers = len(skipped_ids)
        subscribers_eating = max(active_subscribers - skipped_subscribers, 0)
        result.append(
            {
                "meal_id": meal.id,
                "meal_type": meal.meal_type,
                "active_subscribers": active_subscribers,
                "skipped_subscribers": skipped_subscribers,
                "subscribers_eating": subscribers_eating,
                "guests": guest_count,
                "expected_headcount": subscribers_eating + guest_count,
            }
        )

    return {"date": tomorrow.isoformat(), "meals": result}
