"""Immutable extra-order snapshots and booking commitments."""
from fastapi import HTTPException
from app import models


def has_extras(db, user_id, meal_id):
    return db.query(models.ALaCarteOrder.id).filter_by(user_id=user_id, meal_id=meal_id, status='confirmed').first() is not None


def guard_extras(db, user_id, meal_id):
    if has_extras(db, user_id, meal_id):
        raise HTTPException(409, 'Extras are already ordered for this meal. Contact your owner before changing it.')


def line_output(line, order):
    return {'order_id':order.id, 'meal_id':order.meal_id, 'item_id':line.item_id,
            'name':line.name, 'name_hi':line.name_hi, 'quantity':line.quantity,
            'unit_price':float(line.unit_price), 'total':float(line.unit_price * line.quantity)}


def booking_lines(db, plan_id):
    return [line_output(line, order) for order in db.query(models.ALaCarteOrder).filter_by(
        plan_id=plan_id, status='confirmed').order_by(models.ALaCarteOrder.id).all() for line in order.lines]
