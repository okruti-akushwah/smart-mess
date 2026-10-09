from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import get_current_user
from app.database import get_db
from app.menu_images import validate_image
from app.menu_catalog import remember


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
    )

    db.add(meal)
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
    if (target_date != meal.date or target_type != meal.meal_type) and db.query(models.MealPlan).filter_by(meal_id=meal_id).first():
        raise HTTPException(409, "This meal has bookings. Keep its date and meal type unchanged.")
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

    orders_exist = (
        db.query(models.MealOrder)
        .filter(
            models.MealOrder.meal_id == meal_id
        )
        .first()
    )

    if orders_exist or db.query(models.MealPlan).filter_by(meal_id=meal_id).first():
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
