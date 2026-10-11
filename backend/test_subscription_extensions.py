import unittest
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4
import test_app
from app import models


class SubscriptionExtensionTests(unittest.TestCase):
    setUp = test_app.ApplicationTests.setUp
    tearDown = test_app.ApplicationTests.tearDown
    account = test_app.ApplicationTests.account
    meal = test_app.ApplicationTests.meal
    plan = test_app.ApplicationTests.plan
    offer = test_app.ApplicationTests.offer

    def test_skip_extends_once_and_undo_removes_credit(self):
        self.plan()
        meal = self.meal()
        original = self.client.get('/subscriptions/current', headers=self.customer).json()[0]
        body = {'meal_id':meal['id']}
        r = self.client.post('/meals/skip', headers=self.customer, json=body)
        self.assertEqual(r.status_code,200,r.text)
        current = self.client.get('/subscriptions/current', headers=self.customer).json()[0]
        self.assertEqual(current['skip_count'],1)
        self.assertEqual(current['end_date'],(date.fromisoformat(original['end_date'])+timedelta(days=1)).isoformat())
        self.assertEqual(self.client.post('/meals/skip', headers=self.customer, json=body).status_code,400)
        self.assertEqual(self.client.post('/meals/add-guest', headers=self.customer, json=body).status_code,409)
        self.assertEqual(self.client.get('/bills/current', headers=self.customer).json()['final_amount'],3000)
        extended = self.meal(days=32)
        upcoming = self.client.get('/meals/upcoming', headers=self.customer).json()
        self.assertTrue(next(m for m in upcoming if m['id']==extended['id'])['booked'])
        self.assertEqual(self.client.post('/meals/undo-skip', headers=self.customer, json=body).status_code,200)
        restored = self.client.get('/subscriptions/current', headers=self.customer).json()[0]
        self.assertEqual(restored['end_date'],original['end_date'])
        self.assertEqual(restored['skip_count'],0)

    def test_pause_multiple_meals_adds_one_day_each_and_cutoffs_block_actions(self):
        self.plan()
        lunch = self.meal()
        self.meal(meal_type='dinner')
        closed = self.meal(days=0, cutoff_time=(datetime.now(timezone.utc)-timedelta(seconds=1)).isoformat())
        for endpoint in ['skip','add-guest','undo-skip']:
            self.assertEqual(self.client.post('/meals/'+endpoint, headers=self.customer,json={'meal_id':closed['id']}).status_code,400)
        body = {'start_date':lunch['date'],'end_date':lunch['date']}
        result = self.client.post('/subscriptions/pause',headers=self.customer,json=body)
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(result.json()['extension_days'],2)
        self.assertEqual(self.client.get('/subscriptions/current',headers=self.customer).json()[0]['skip_count'],2)
        self.assertEqual(self.client.post('/subscriptions/pause',headers=self.customer,json=body).json()['skipped'],0)

    def test_future_subscription_moves_without_overlap_and_restores_on_undo(self):
        self.plan()
        with self.Session() as db:
            first=db.query(models.MealPlan).one()
            future=models.MealPlan(owner_id=self.owner_id,user_id=self.customer_id,price=700,meal_price=50,
                start_date=first.end_date+timedelta(days=1),end_date=first.end_date+timedelta(days=7),status='pending_payment')
            original=future.start_date
            db.add(future);db.commit(); future_id=future.id
        meal=self.meal();body={'meal_id':meal['id']}
        self.client.post('/meals/skip',headers=self.customer,json=body)
        with self.Session() as db:
            self.assertEqual(db.get(models.MealPlan,future_id).start_date,original+timedelta(days=1))
        self.client.post('/meals/undo-skip',headers=self.customer,json=body)
        with self.Session() as db:
            self.assertEqual(db.get(models.MealPlan,future_id).start_date,original)

    def test_single_meal_needs_paid_confirmation_and_owner_acceptance(self):
        self.client.put('/delivery/address',headers=self.customer,json={'address':'Flat 12, Test Road, Pune 411001'})
        meal=self.meal(single_price=120)
        r=self.client.post('/customer/checkout',headers=self.customer,json={'meal_id':meal['id'],'expected_price':120,'purchase_key':str(uuid4())})
        self.assertEqual(r.status_code,201,r.text)
        plan_id,bill=r.json()['plan_id'],r.json()['id']
        self.assertEqual(self.client.post(f'/owner/personal-orders/{plan_id}/accept',headers=self.owner).status_code,409)
        self.assertEqual(self.client.post('/payments/submissions',headers=self.customer,data={'bill_id':bill,'amount':120,'method':'cash'}).status_code,422)
        paid=self.client.post('/owner/payments',headers=self.owner,json={'plan_id':plan_id,'amount':120,'receipt_key':str(uuid4()),'reference':'UPI received'})
        self.assertEqual(paid.status_code,201,paid.text)
        self.assertEqual(self.client.get('/owner/personal-orders',headers=self.owner).json()[0]['status'],'pending_acceptance')
        self.assertEqual(self.client.get('/dashboard/headcount',headers=self.owner).json()['meals'][0]['expected_headcount'],0)
        other,_=self.account('9876543299','owner')
        self.assertEqual(self.client.get('/owner/personal-orders',headers=other).json(),[])
        self.assertEqual(self.client.post(f'/owner/personal-orders/{plan_id}/accept',headers=other).status_code,404)
        for _ in range(2):
            self.assertEqual(self.client.post(f'/owner/personal-orders/{plan_id}/accept',headers=self.owner).status_code,200)
        dashboard=self.client.get('/dashboard/headcount',headers=self.owner).json()
        row=next(m for m in dashboard['preparation'] if m['meal_id']==meal['id'])
        self.assertEqual(row['personal_orders'],1)
        self.assertEqual(row['expected_headcount'],1)
        self.assertEqual(row['menu_description'],meal['menu_description'])

    def test_extension_migration_preserves_legacy_skips_and_is_idempotent(self):
        from sqlalchemy import create_engine,text
        from app.migrations import add_subscription_extensions
        engine=create_engine('sqlite://')
        with engine.begin() as connection:
            connection.execute(text('CREATE TABLE meal_plans (id INTEGER PRIMARY KEY, start_date DATE, end_date DATE, meal_id INTEGER, status VARCHAR)'))
            connection.execute(text('CREATE TABLE meal_orders (id INTEGER PRIMARY KEY, status VARCHAR)'))
            connection.execute(text("INSERT INTO meal_plans VALUES (1,'2026-10-01','2026-10-31',NULL,'active')"))
            connection.execute(text("INSERT INTO meal_orders VALUES (1,'skipped')"))
        add_subscription_extensions(engine);add_subscription_extensions(engine)
        with engine.connect() as connection:
            self.assertEqual(connection.execute(text('SELECT original_end_date,skip_count FROM meal_plans')).one(),('2026-10-31',0))
            self.assertEqual(connection.execute(text('SELECT status,extension_plan_id FROM meal_orders')).one(),('skipped',None))
        engine.dispose()
