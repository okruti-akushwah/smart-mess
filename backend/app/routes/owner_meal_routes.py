from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import get_current_user
from app.database import get_db
from app.menu_images import validate_image
from app.menu_catalog import remember
from app.date_pauses import lock_mess, apply_date_pauses
from app.weekly_menu import sync_weekly_menu, weekly_menu_lock


router = APIRouter(
    prefix="/owner/meals",
    tags=["owner meals"],
)


# =========================================================
# OWNER CHECK
# =========================================================

def require_owner(
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "owner":
        raise HTTPException(
            status_code=403,
            detail="Owner access required",
        )

    return current_user


def has_customer_activity(db: Session, meal_id: int) -> bool:
    """Return whether customers have recorded an action tied to this meal."""
    for model in (models.MealOrder, models.DeliveryUpdate, models.Feedback, models.ALaCarteOrder):
        if db.query(model.id).filter(model.meal_id == meal_id).first():
            return True
    return False


# =========================================================
# GET ALL MEALS
# =========================================================

@router.get(
    "",
    response_model=list[schemas.MealOut],
)
def get_all_meals(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
):
    with weekly_menu_lock(current_user.id):
        sync_weekly_menu(db, current_user.id)
        db.commit()
    meals = (
        db.query(models.Meal)
        .filter(models.Meal.date >= date.today())
        .order_by(
            models.Meal.date,
            models.Meal.cutoff_time,
        )
        .all()
    )

    return meals


# =========================================================
# CREATE MEAL
# =========================================================

@router.post(
    "",
    response_model=schemas.MealOut,
    status_code=201,
)
def create_meal(
    req: schemas.MealCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
):
    lock_mess(db)
    meal_type = req.meal_type.strip().lower()

    if meal_type not in {
        "breakfast",
        "lunch",
        "dinner",
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "Meal type must be breakfast, "
                "lunch or dinner"
            ),
        )

    existing_meal = (
        db.query(models.Meal)
        .filter(
            models.Meal.date == req.date,
            models.Meal.meal_type == meal_type,
        )
        .first()
    )

    if existing_meal:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{meal_type.title()} already exists "
                f"for {req.date}"
            ),
        )

    validate_image(req.menu_description, req.image_url, current_user.id)
    meal = models.Meal(
        date=req.date,
        meal_type=meal_type,
        menu_description=req.menu_description,
        is_complimentary=req.is_complimentary,
        cutoff_time=req.cutoff_time,
        image_url=req.image_url,
        single_price=req.single_price,
        weekly_menu_override=True,
    )

    db.add(meal)
    db.flush()
    apply_date_pauses(db, meal)
    remember(db, current_user.id, meal.menu_description)
    db.commit()
    db.refresh(meal)

    return meal


# =========================================================
# UPDATE MEAL
# =========================================================

@router.put(
    "/{meal_id}",
    response_model=schemas.MealOut,
)
def update_meal(
    meal_id: int,
    req: schemas.MealUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
):
    meal = (
        db.query(models.Meal)
        .filter(models.Meal.id == meal_id)
        .first()
    )

    if not meal:
        raise HTTPException(
            status_code=404,
            detail="Meal not found",
        )

    lock_mess(db)
    previous_date = meal.date
    update_data = req.model_dump(
        exclude_unset=True
    )

    if "meal_type" in update_data:
        meal_type = (
            update_data["meal_type"]
            .strip()
            .lower()
        )

        if meal_type not in {
            "breakfast",
            "lunch",
            "dinner",
        }:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Meal type must be breakfast, "
                    "lunch or dinner"
                ),
            )

        update_data["meal_type"] = meal_type

    target_date = update_data.get("date", meal.date)
    target_type = update_data.get("meal_type", meal.meal_type)
    if target_date != meal.date or target_type != meal.meal_type:
        has_personal_booking = db.query(models.MealPlan.id).filter_by(meal_id=meal_id).first()
        if has_personal_booking or has_customer_activity(db, meal_id):
            raise HTTPException(409, "This meal has bookings or customer activity. Keep its date and meal type unchanged.")
    duplicate = db.query(models.Meal).filter(
        models.Meal.date == target_date,
        models.Meal.meal_type == target_type,
        models.Meal.id != meal_id,
    ).first()
    if duplicate:
        raise HTTPException(400, "A meal of this type already exists for that date")

    if "menu_description" in update_data and update_data["menu_description"] != meal.menu_description:
        update_data.setdefault("image_url", None)
    if "image_url" in update_data:
        validate_image(update_data.get("menu_description", meal.menu_description), update_data["image_url"], current_user.id)
    for field, value in update_data.items():
        setattr(meal, field, value)
    # Preserve an intentional one-date edit when the weekly template is refreshed.
    meal.weekly_menu_entry_id = None
    meal.weekly_menu_override = True

    if meal.date != previous_date:
        db.flush()
        apply_date_pauses(db, meal)
    remember(db, current_user.id, meal.menu_description)
    db.commit()
    db.refresh(meal)

    return meal


# =========================================================
# DELETE MEAL
# =========================================================

@router.delete("/{meal_id}")
def delete_meal(
    meal_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
):
    meal = (
        db.query(models.Meal)
        .filter(models.Meal.id == meal_id)
        .first()
    )

    if not meal:
        raise HTTPException(
            status_code=404,
            detail="Meal not found",
        )

    if meal.weekly_menu_entry_id is not None:
        raise HTTPException(409, "This meal repeats from the weekly menu. Edit or remove that weekday slot instead.")

    has_personal_booking = db.query(models.MealPlan.id).filter_by(meal_id=meal_id).first()
    if has_personal_booking or has_customer_activity(db, meal_id):
        raise HTTPException(
            status_code=400,
            detail=(
                "Cannot delete this meal because "
                "customer actions already exist."
            ),
        )

    db.delete(meal)
    db.commit()

    return {
        "message": "Meal deleted successfully"
    }
