import unittest
from datetime import date, timedelta
from uuid import uuid4
from sqlalchemy import create_engine, text, inspect
import test_app
from app import models
from app.migrations import add_plan_meal_types


class PlanMealTypeTests(unittest.TestCase):
    setUp = test_app.ApplicationTests.setUp
    tearDown = test_app.ApplicationTests.tearDown
    meal = test_app.ApplicationTests.meal
    account = test_app.ApplicationTests.account
    offer = test_app.ApplicationTests.offer

    def assign_lunch(self):
        r = self.client.post('/owner/plans', headers=self.owner, json={
            'user_id': self.customer_id, 'price': 1500, 'meal_price': 50,
            'start_date': date.today().isoformat(), 'end_date': (date.today()+timedelta(days=30)).isoformat(),
            'meal_types': ['lunch']})
        self.assertEqual(r.status_code, 201, r.text)

    def test_lunch_only_controls_counts_deliveries_and_skips(self):
        self.assign_lunch()
        lunch = self.meal()
        dinner = self.meal(meal_type='dinner')
        upcoming = {m['id']: m for m in self.client.get('/meals/upcoming', headers=self.customer).json()}
        self.assertTrue(upcoming[lunch['id']]['booked'])
        self.assertFalse(upcoming[dinner['id']]['booked'])
        for endpoint in ['skip', 'add-guest', 'undo-skip']:
            self.assertEqual(self.client.post('/meals/'+endpoint, headers=self.customer,
                json={'meal_id': dinner['id']}).status_code, 403)
        counts = self.client.get('/dashboard/headcount', headers=self.owner).json()
        by_type = {m['meal_type']: m['expected_headcount'] for m in counts['meals']}
        self.assertEqual(by_type, {'lunch': 1, 'dinner': 0})
        rows = self.client.get('/owner/deliveries', headers=self.owner, params={'day': lunch['date']}).json()
        self.assertEqual([r['meal_type'] for r in rows], ['lunch'])
        result = self.client.post('/subscriptions/pause', headers=self.customer,
            json={'start_date': lunch['date'], 'end_date': lunch['date']})
        self.assertEqual(result.json()['skipped'], 1)
        plan = self.client.get('/subscriptions/current', headers=self.customer).json()[0]
        self.assertEqual(plan['meal_types'], ['lunch'])
        self.assertEqual(plan['skip_count'], 1)

    def test_saved_pause_only_applies_to_included_future_menus(self):
        self.assign_lunch()
        day = (date.today()+timedelta(days=2)).isoformat()
        r = self.client.post('/subscriptions/pause', headers=self.customer,
            json={'start_date':day,'end_date':day})
        self.assertEqual(r.status_code, 200, r.text)
        self.meal(days=2, meal_type='breakfast')
        self.meal(days=2, meal_type='dinner')
        self.meal(days=2, meal_type='lunch')
        with self.Session() as db:
            self.assertEqual(db.query(models.MealOrder).count(), 1)
            self.assertEqual(db.query(models.MealPlan).one().skip_count, 1)

    def test_offer_validation_checkout_snapshot_and_extra_meal_purchase(self):
        for types in [[], ['snack'], ['lunch', 'lunch']]:
            r = self.client.post('/owner/offers', headers=self.owner, json={
                'name':'Lunch plan', 'category':'regular', 'duration_days':7,
                'price':700, 'meal_price':50, 'description':'Lunch for seven days', 'meal_types':types})
            self.assertEqual(r.status_code, 422, r.text)
        offer = self.offer(meal_types=['lunch'])
        self.assertEqual(offer['meal_types'], ['lunch'])
        self.client.put('/delivery/address', headers=self.customer, json={'address':'Room 214, College Road, Pune'})
        r = self.client.post('/customer/checkout', headers=self.customer, json={
            'offer_id':offer['id'], 'start_date':date.today().isoformat(),
            'expected_price':700, 'purchase_key':str(uuid4())})
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(r.json()['meal_types'], ['lunch'])
        with self.Session() as db:
            plan = db.query(models.MealPlan).one()
            plan.status = 'active'
            db.query(models.PlanOffer).one().meal_types = ['dinner']
            db.commit()
        self.assertEqual(self.client.get('/subscriptions/current',headers=self.customer).json()[0]['meal_types'], ['lunch'])
        dinner = self.meal(days=0, single_price=90, meal_type='dinner')
        r = self.client.post('/customer/checkout', headers=self.customer, json={
            'meal_id':dinner['id'], 'expected_price':90, 'purchase_key':str(uuid4())})
        self.assertEqual(r.status_code, 201, r.text)

    def test_migration_preserves_legacy_all_meals_and_is_repeatable(self):
        engine = create_engine('sqlite://')
        try:
            with engine.begin() as c:
                c.execute(text('CREATE TABLE plan_offers (id INTEGER PRIMARY KEY)'))
                c.execute(text('CREATE TABLE meal_plans (id INTEGER PRIMARY KEY)'))
                c.execute(text('INSERT INTO meal_plans (id) VALUES (1)'))
            add_plan_meal_types(engine)
            add_plan_meal_types(engine)
            with engine.connect() as c:
                self.assertIn('meal_types', {col['name'] for col in inspect(c).get_columns('plan_offers')})
                import json
                self.assertEqual(json.loads(c.execute(text('SELECT meal_types FROM meal_plans')).scalar()), ['breakfast','lunch','dinner'])
        finally:
            engine.dispose()
