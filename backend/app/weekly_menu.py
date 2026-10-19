"""Keep dated meal records in sync with each mess's recurring weekly menu."""
from datetime import date, datetime, time, timedelta
from threading import Lock

from app import models
from app.date_pauses import apply_date_pauses, lock_mess


HORIZON_DAYS = 14
_lock_registry_guard = Lock()
_owner_locks = {}


def weekly_menu_lock(owner_id):
    """Serialize local lazy-publishing requests for the same mess."""
    with _lock_registry_guard:
        return _owner_locks.setdefault(owner_id, Lock())


def _cutoff_for(day, cutoff_time):
    if not cutoff_time:
        return None
    hour, minute = (int(part) for part in cutoff_time.split(":"))
    return datetime.combine(day, time(hour, minute))


def has_customer_activity(db, meal_id):
    for model in (models.MealOrder, models.DeliveryUpdate, models.Feedback, models.ALaCarteOrder):
        if db.query(model.id).filter(model.meal_id == meal_id).first():
            return True
    return db.query(models.MealPlan.id).filter_by(meal_id=meal_id).first() is not None


def sync_weekly_menu(db, owner_id, start=None, days=HORIZON_DAYS):
    """Create missing dated meals and refresh untouched generated meals only."""
    start = start or date.today()
    lock_mess(db)
    entries = db.query(models.WeeklyMenuEntry).filter_by(owner_id=owner_id).order_by(
        models.WeeklyMenuEntry.weekday, models.WeeklyMenuEntry.meal_type
    ).all()
    if not entries:
        return 0

    end = start + timedelta(days=max(0, days))
    meals_by_slot = {(meal.date, meal.meal_type): meal for meal in db.query(models.Meal).filter(
        models.Meal.owner_id == owner_id, models.Meal.date >= start, models.Meal.date < end
    ).all()}
    activity_ids = set()
    meal_ids = [meal.id for meal in meals_by_slot.values()]
    if meal_ids:
        for model in (models.MealOrder, models.DeliveryUpdate, models.Feedback, models.MealPlan, models.ALaCarteOrder):
            activity_ids.update(row[0] for row in db.query(model.meal_id).filter(
                model.meal_id.in_(meal_ids)
            ).distinct().all())

    created = 0
    for offset in range(max(0, days)):
        meal_date = start + timedelta(days=offset)
        for entry in entries:
            if meal_date.weekday() != entry.weekday:
                continue
            meal = meals_by_slot.get((meal_date, entry.meal_type))
            if meal is None:
                meal = models.Meal(
                    owner_id=owner_id,
                    date=meal_date,
                    meal_type=entry.meal_type,
                    menu_description=entry.menu_description,
                    image_url=entry.image_url,
                    single_price=entry.single_price,
                    is_complimentary=entry.is_complimentary,
                    cutoff_time=_cutoff_for(meal_date, entry.cutoff_time),
                    weekly_menu_entry_id=entry.id,
                    weekly_menu_override=False,
                )
                db.add(meal)
                db.flush()
                meals_by_slot[(meal_date, entry.meal_type)] = meal
                apply_date_pauses(db, meal)
                created += 1
                continue

            # Existing dates without activity adopt the template; a date-specific
            # owner edit detaches the row and remains an exception to the pattern.
            if meal.weekly_menu_override or meal.id in activity_ids:
                continue
            meal.weekly_menu_entry_id = entry.id
            meal.menu_description = entry.menu_description
            meal.image_url = entry.image_url
            meal.single_price = entry.single_price
            meal.is_complimentary = entry.is_complimentary
            meal.cutoff_time = _cutoff_for(meal_date, entry.cutoff_time)
    return created
