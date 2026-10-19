from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.auth import get_current_user
from app.meal_coverage import covers, included_types


router = APIRouter(prefix="/bills", tags=["billing"])


# =========================================================
# GET CURRENT LIVE BILL
# =========================================================

@router.get("/current")
def get_current_bill(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    plan_id: int | None = None,
):
    """
    Calculates the logged-in customer's live bill.

    Formula:
        Base Plan Price
        - Skip Deductions
        + Extra / Guest Costs
        = Current Final Amount
    """

    today = date.today()

    # -----------------------------------------------------
    # 1. Find user's active meal plan
    # -----------------------------------------------------

    query = db.query(models.MealPlan).filter(models.MealPlan.user_id == current_user.id,
        models.MealPlan.status == "active")
    if plan_id is not None:
        query = query.filter(models.MealPlan.id == plan_id)
    else:
        query = query.filter(models.MealPlan.meal_id.is_(None),
            models.MealPlan.start_date <= today, models.MealPlan.end_date >= today)
    meal_plan = query.first()

    if not meal_plan:
        raise HTTPException(
            status_code=404,
            detail="No active meal plan found"
        )

    # -----------------------------------------------------
    # 2. Calculate orders across the full subscription period
    # -----------------------------------------------------

    # -----------------------------------------------------
    # 3. Get this subscription's meal orders
    # -----------------------------------------------------

    orders = (
        db.query(models.MealOrder)
        .join(
            models.Meal,
            models.MealOrder.meal_id == models.Meal.id
        )
        .filter(
            models.MealOrder.user_id == current_user.id,
            models.Meal.date >= meal_plan.start_date,
            models.Meal.date <= meal_plan.end_date,
        )
        .all()
    )

    # -----------------------------------------------------
    # 4. Count skipped meals
    # -----------------------------------------------------

    orders = [order for order in orders if covers(meal_plan, order.meal)]

    skipped_orders = [
        order
        for order in orders
        if order.status == "skipped"
    ]

    skipped_meals = len(skipped_orders)

    # -----------------------------------------------------
    # 5. Calculate skip deductions
    # -----------------------------------------------------

    meal_price = Decimal(str(meal_plan.meal_price or 0))

    deductions = meal_price * sum(1 for order in skipped_orders if order.extension_plan_id is None)

    # -----------------------------------------------------
    # 6. Calculate extras / guest costs
    # -----------------------------------------------------

    extras_total = Decimal("0")

    for order in orders:
        if order.extra_cost:
            extras_total += Decimal(str(order.extra_cost))

    # -----------------------------------------------------
    # 7. Calculate final amount
    # -----------------------------------------------------

    from app.a_la_carte import booking_lines
    extra_lines = booking_lines(db, meal_plan.id)
    extras_total += sum((Decimal(str(line['total'])) for line in extra_lines), Decimal('0'))
    base_amount = Decimal(str(meal_plan.price or 0))

    final_amount = (
        base_amount
        - deductions
        + extras_total
    )

    # Prevent accidental negative bills
    if final_amount < 0:
        final_amount = Decimal("0")

    # -----------------------------------------------------
    # 8. Return transparent bill
    # -----------------------------------------------------

    paid = sum((Decimal(str(p.amount)) for p in db.query(models.PaymentRecord).filter_by(plan_id=meal_plan.id).all()), Decimal("0"))
    return {
        "plan_id": meal_plan.id,
        "amount_paid": float(paid),
        "balance_due": float(max(final_amount - paid, Decimal("0"))),
        "credit": float(max(paid - final_amount, Decimal("0"))),
        "month": today.strftime("%Y-%m"),

        "plan_type": meal_plan.plan_type, "meal_types": included_types(meal_plan),
        "start_date": meal_plan.start_date.isoformat(),
        "end_date": meal_plan.end_date.isoformat(),

        "base_amount": float(base_amount),

        "meal_price": float(meal_price),

        "skipped_meals": skipped_meals,
        "extension_days": meal_plan.skip_count or 0,

        "deductions": float(deductions),

        "extras_total": float(extras_total),
        "extra_lines": extra_lines,

        "final_amount": float(final_amount),

        "breakdown": {
            "formula": (
                "base_amount - deductions + extras_total"
            )
        }
    }


# =========================================================
# GET BILL HISTORY
# =========================================================

@router.get("/history")
def get_bill_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Returns previously generated bills for the logged-in user.
    """

    bills = (
        db.query(models.Bill)
        .filter(
            models.Bill.user_id == current_user.id
        )
        .order_by(models.Bill.id.desc())
        .all()
    )

    return bills
