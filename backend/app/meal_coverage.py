ALL_MEALS = ["breakfast", "lunch", "dinner"]


def included_types(plan):
    return plan.meal_types if plan.meal_types is not None else ALL_MEALS


def covers(plan, meal):
    return (plan.start_date <= meal.date <= plan.end_date and
            (plan.meal_id == meal.id if plan.meal_id is not None else meal.meal_type in included_types(plan)))
