import os
os.environ['DATABASE_URL'] = 'sqlite://'
from datetime import date, timedelta
from decimal import Decimal
import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.database import Base
from app import models, schemas
from app.routes.plan_routes import assign_plan
from app.routes.purchase_routes import activate_paid_purchase
from app.tenancy import scope


class AssignmentPaymentTests(unittest.TestCase):
    def test_assignment_replacement_and_confirmed_payment_activation(self):
        engine = create_engine('sqlite://')
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            owner = models.User(name='Owner', phone='9230000001', role='owner', password_hash='test')
            db.add(owner)
            db.flush()
            customer = models.User(name='Customer', phone='9230000002', role='customer', password_hash='test', mess_owner_id=owner.id)
            db.add(customer)
            db.commit()
            scope(db, owner.id)
            req = schemas.PlanCreate(user_id=customer.id, price=1200, meal_price=50,
                meal_types=['lunch'], start_date=date.today(), end_date=date.today()+timedelta(days=10))
            first = assign_plan(req, db, owner)
            self.assertEqual(first['status'], 'pending_payment')
            self.assertEqual(db.query(models.MealPlan).filter_by(status='active').count(), 0)
            self.assertEqual(db.query(models.IssuedBill).count(), 1)
            second = assign_plan(req, db, owner)
            self.assertEqual(db.get(models.MealPlan, first['id']).status, 'cancelled')
            plan = db.get(models.MealPlan, second['id'])
            db.add(models.PaymentRecord(owner_id=owner.id, plan_id=plan.id, amount=Decimal('200'), receipt_key='partial'))
            db.flush()
            activate_paid_purchase(plan, db)
            self.assertEqual(plan.status, 'pending_payment')
            with self.assertRaises(HTTPException):
                assign_plan(req, db, owner)
            db.add(models.PaymentRecord(owner_id=owner.id, plan_id=plan.id, amount=Decimal('1000'), receipt_key='full'))
            db.flush()
            activate_paid_purchase(plan, db)
            self.assertEqual(plan.status, 'active')
            db.commit()
            with self.assertRaises(HTTPException):
                assign_plan(req, db, owner)
        engine.dispose()
