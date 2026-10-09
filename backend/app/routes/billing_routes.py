from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.auth import get_current_user


router = APIRouter(prefix="/bills", tags=["billing"])


# =========================================================
# GET CURRENT LIVE BILL
# =========================================================

@router.get("/current")
def get_current_bill(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
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

    meal_plan = (
        db.query(models.MealPlan)
        .filter(
            models.MealPlan.user_id == current_user.id,
            models.MealPlan.status == "active",
            models.MealPlan.meal_id.is_(None),
            models.MealPlan.start_date <= today,
            models.MealPlan.end_date >= today,
        )
        .first()
    )

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

    deductions = meal_price * skipped_meals

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

        "plan_type": meal_plan.plan_type,
        "start_date": meal_plan.start_date.isoformat(),
        "end_date": meal_plan.end_date.isoformat(),

        "base_amount": float(base_amount),

        "meal_price": float(meal_price),

        "skipped_meals": skipped_meals,

        "deductions": float(deductions),

        "extras_total": float(extras_total),

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
