import os
os.environ['DATABASE_URL'] = 'sqlite://'
from datetime import date, datetime, timedelta
from decimal import Decimal
import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.database import Base
from app import models, schemas
from app.routes.meal_routes import add_guest


class GuestMealPriceTests(unittest.TestCase):
    def test_meal_specific_price_and_existing_booking_preserved(self):
        engine = create_engine('sqlite://')
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            user = models.User(name='Test', phone='9231111111', role='customer', password_hash='test')
            db.add(user)
            db.flush()
            day = date.today() + timedelta(days=1)
            db.add(models.MealPlan(user_id=user.id, price=1000, meal_price=50, start_date=day, end_date=day, status='active'))
            db.add(models.GuestPricing(price=5))
            meals = [models.Meal(date=day, meal_type=kind, cutoff_time=datetime.combine(day, datetime.max.time()), single_price=price) for kind, price in [('lunch', 120), ('dinner', 150), ('breakfast', None)]]
            db.add_all(meals)
            db.commit()
            add_guest(schemas.AddGuestRequest(meal_id=meals[0].id, guest_count=2, expected_unit_price=120), db, user)
            order = db.query(models.MealOrder).filter_by(meal_id=meals[0].id).one()
            self.assertEqual(order.extra_cost, Decimal('240'))
            meals[0].single_price = 130
            db.commit()
            self.assertEqual(order.extra_cost, Decimal('240'))
            with self.assertRaises(HTTPException) as stale:
                add_guest(schemas.AddGuestRequest(meal_id=meals[1].id, guest_count=1, expected_unit_price=120), db, user)
            self.assertEqual(stale.exception.status_code, 409)
            add_guest(schemas.AddGuestRequest(meal_id=meals[1].id, guest_count=1, expected_unit_price=150), db, user)
            self.assertEqual(db.query(models.MealOrder).filter_by(meal_id=meals[1].id).one().extra_cost, Decimal('150'))
            with self.assertRaises(HTTPException) as missing:
                add_guest(schemas.AddGuestRequest(meal_id=meals[2].id, guest_count=1), db, user)
            self.assertEqual(missing.exception.status_code, 409)
        engine.dispose()
