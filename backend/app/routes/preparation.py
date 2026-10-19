from datetime import date, datetime, timezone
from app import models
from app.meal_coverage import covers


def meal_counts(meal, plans, orders):
    subscriptions = {p.user_id for p in plans if p.meal_id is None and covers(p, meal)}
    personal = {p.user_id for p in plans if p.meal_id == meal.id}
    actions = [o for o in orders if o.meal_id == meal.id and o.user_id in subscriptions]
    skipped = {o.user_id for o in actions if o.status == "skipped"}
    guests = sum(o.guest_count or 1 for o in actions if o.status == "guest_added")
    closed = meal.date < date.today() or bool(meal.cutoff_time and
        meal.cutoff_time.replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc))
    return {"meal_id": meal.id, "date": meal.date, "meal_type": meal.meal_type,
        "menu_description": meal.menu_description, "cutoff_time": meal.cutoff_time,
        "changes_closed": closed, "active_subscribers": len(subscriptions),
        "skipped_subscribers": len(skipped), "subscribers_eating": len(subscriptions - skipped),
        "personal_orders": len(personal - subscriptions), "guests": guests,
        "expected_headcount": len((subscriptions - skipped) | personal) + guests}


def preparation(db):
    today = date.today()
    plans = db.query(models.MealPlan).filter_by(status="active").all()
    orders = db.query(models.MealOrder).all()
    upcoming = db.query(models.Meal).filter(models.Meal.date >= today).order_by(
        models.Meal.date, models.Meal.cutoff_time, models.Meal.id).all()
    latest_date = db.query(models.Meal.date).filter(models.Meal.date < today).order_by(models.Meal.date.desc()).first()
    latest = db.query(models.Meal).filter_by(date=latest_date[0]).all() if latest_date else []
    def with_extras(meal):
        row = meal_counts(meal, plans, orders)
        quantities = {}
        for order in db.query(models.ALaCarteOrder).filter_by(meal_id=meal.id, status='confirmed').all():
            for line in order.lines:
                key = (line.item_id, line.name, line.name_hi)
                quantities[key] = quantities.get(key, 0) + line.quantity
        row['extra_items'] = [{'item_id':key[0], 'name':key[1], 'name_hi':key[2], 'quantity':quantity} for key,quantity in quantities.items()]
        return row
    return {"preparation": [with_extras(m) for m in upcoming],
        "latest_meals": [with_extras(m) for m in latest]}
