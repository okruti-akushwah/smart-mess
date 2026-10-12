import os
os.environ['DATABASE_URL'] = 'sqlite://'
from datetime import date, timedelta
import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.database import Base
from app import models
from app.tenancy import scope
from app.routes.plan_routes import customers


class CustomerDirectoryTests(unittest.TestCase):
    def test_contact_details_and_plans_are_mess_scoped(self):
        engine = create_engine('sqlite://')
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            owners = [models.User(name=f'Owner {i}', phone=f'924000000{i}', role='owner', password_hash='test') for i in [1, 2]]
            db.add_all(owners)
            db.flush()
            members = [models.User(name=f'Customer {i}', phone=f'924000001{i}', role='customer', password_hash='test', mess_owner_id=owner.id) for i, owner in enumerate(owners)]
            db.add_all(members)
            db.flush()
            for owner, member in zip(owners, members):
                db.add(models.DeliveryProfile(owner_id=owner.id, user_id=member.id, address=f'Private address {member.id}', instructions='Call on arrival'))
                db.add(models.JoinRequest(owner_id=owner.id, user_id=member.id, status='approved'))
                db.add(models.MealPlan(owner_id=owner.id, user_id=member.id, plan_type='Lunch plan', price=700, status='pending_payment', start_date=date.today(), end_date=date.today()+timedelta(days=7)))
            db.commit()
            owner_id, member_id = owners[0].id, members[0].id
            scope(db, owner_id)
            rows = customers(db, owners[0])
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]['id'], member_id)
            self.assertEqual(rows[0]['address'], f'Private address {member_id}')
            self.assertEqual(rows[0]['subscriptions'][0]['status'], 'awaiting_payment')
            self.assertNotIn('password_hash', rows[0])
        engine.dispose()
