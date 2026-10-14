from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.menu_images import validate_image
from app.menu_catalog import remember
from app.routes.owner_meal_routes import require_owner
from app.date_pauses import lock_mess
from app.weekly_menu import has_customer_activity, sync_weekly_menu, weekly_menu_lock


router = APIRouter(prefix="/owner/weekly-menu", tags=["owner weekly menu"])


@router.get("")
def get_weekly_menu(db: Session = Depends(get_db), owner: models.User = Depends(require_owner)):
    with weekly_menu_lock(owner.id):
        sync_weekly_menu(db, owner.id)
        db.commit()
    items = db.query(models.WeeklyMenuEntry).filter_by(owner_id=owner.id).order_by(
        models.WeeklyMenuEntry.weekday, models.WeeklyMenuEntry.meal_type
    ).all()
    return [schemas.WeeklyMenuItem(
        weekday=item.weekday,
        meal_type=item.meal_type,
        menu_description=item.menu_description,
        image_url=item.image_url,
        single_price=float(item.single_price) if item.single_price is not None else None,
        is_complimentary=item.is_complimentary,
        cutoff_time=item.cutoff_time,
    ) for item in items]


@router.put("")
def save_weekly_menu(req: schemas.WeeklyMenuSave, db: Session = Depends(get_db),
                     owner: models.User = Depends(require_owner)):
    with weekly_menu_lock(owner.id):
        return _save_weekly_menu(req, db, owner)


def _save_weekly_menu(req: schemas.WeeklyMenuSave, db: Session, owner: models.User):
    lock_mess(db)
    existing = {(item.weekday, item.meal_type): item for item in db.query(
        models.WeeklyMenuEntry).filter_by(owner_id=owner.id).all()}
    submitted = {(item.weekday, item.meal_type): item for item in req.items}

    for key, payload in submitted.items():
        validate_image(payload.menu_description, payload.image_url, owner.id)
        entry = existing.get(key)
        if entry is None:
            entry = models.WeeklyMenuEntry(owner_id=owner.id, weekday=payload.weekday,
                                           meal_type=payload.meal_type)
            db.add(entry)
        for field in ("menu_description", "image_url", "single_price", "is_complimentary", "cutoff_time"):
            setattr(entry, field, getattr(payload, field))
        remember(db, owner.id, payload.menu_description)

    for key, entry in existing.items():
        if key in submitted:
            continue
        # Preserve dates with member activity; remove untouched generated dates.
        for meal in db.query(models.Meal).filter_by(weekly_menu_entry_id=entry.id).all():
            if has_customer_activity(db, meal.id):
                meal.weekly_menu_entry_id = None
            else:
                db.delete(meal)
        db.delete(entry)

    db.flush()
    sync_weekly_menu(db, owner.id, start=date.today())
    db.commit()
    return {"message": "Weekly menu saved and upcoming meals updated."}
