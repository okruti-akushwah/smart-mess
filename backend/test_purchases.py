import test_app
from datetime import date, datetime, timedelta
from uuid import uuid4
from app import models


class PurchaseTests(test_app.ApplicationTests):
    def address(self):
        r = self.client.put('/delivery/address', headers=self.customer, json={'address': 'Flat 12, Test Road, Pune 411001'})
        self.assertEqual(r.status_code, 200, r.text)

    def buy(self, **choice):
        return self.client.post('/customer/checkout', headers=self.customer, json={'purchase_key': str(uuid4()), **choice})

    def pay(self, bill, amount, approve=True):
        r = self.client.post('/payments/submissions', headers=self.customer, data={'bill_id': bill, 'amount': str(amount), 'method': 'upi'}, files={'file':('proof.png', b'\x89PNG\r\n\x1a\n' + b'0'*40 + b'IEND\xaeB`\x82', 'image/png')})
        self.assertEqual(r.status_code, 201, r.text)
        submission = self.client.get('/payments/submissions', headers=self.customer).json()[0]['id']
        if approve:
            r = self.client.patch(f'/owner/payment-submissions/{submission}', headers=self.owner, json={'status': 'approved'})
            self.assertEqual(r.status_code, 200, r.text)
        return submission

    def test_address_first_and_subscription_activation_after_full_payment(self):
        offer = self.offer()
        body = {'offer_id': offer['id'], 'start_date': date.today().isoformat(), 'expected_price': 700}
        self.assertEqual(self.buy(**body).status_code, 409)

        self.address()
        r = self.buy(**body)
        self.assertEqual(r.status_code, 201, r.text)
        bill = r.json()['id']
        self.assertEqual(self.client.get('/subscriptions/current', headers=self.customer).json(), [])
        s = self.pay(bill, 200, approve=False)
        self.assertEqual(self.client.get('/customer/activity', headers=self.customer).json()['purchases'][0]['amount_paid'], 0)
        self.assertEqual(self.client.patch(f'/owner/payment-submissions/{s}', headers=self.owner, json={'status':'approved'}).status_code, 200)
        self.assertEqual(self.client.get('/subscriptions/current', headers=self.customer).json(), [])
        self.pay(bill, 500)
        current = self.client.get('/subscriptions/current', headers=self.customer).json()
        self.assertEqual(len(current), 1)
        activity = self.client.get('/customer/activity', headers=self.customer).json()
        self.assertEqual(activity['purchases'][0]['amount_paid'], 700)
        self.assertEqual(len(activity['receipts']), 2)
        self.assertEqual(self.buy(**body).status_code, 409)

    def test_legacy_plan_request_does_not_block_current_checkout(self):
        offer = self.offer()
        request = self.client.post('/subscriptions/requests', headers=self.customer,
            json={'offer_id': offer['id'], 'start_date': date.today().isoformat()})
        self.assertEqual(request.status_code, 201, request.text)
        self.address()

        checkout = self.buy(offer_id=offer['id'], start_date=date.today().isoformat(), expected_price=700)

        self.assertEqual(checkout.status_code, 201, checkout.text)
        self.assertEqual(checkout.json()['status'], 'pending_payment')

    def test_single_meal_books_only_selected_meal_and_reviews_next_day(self):
        self.address()
        lunch = self.meal(days=0, single_price=120)
        dinner = self.meal(days=0, meal_type='dinner', single_price=150)
        r = self.buy(meal_id=lunch['id'], expected_price=120)
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(self.client.get('/dashboard/headcount', headers=self.owner).json()['preparation'][0]['expected_headcount'], 0)
        self.pay(r.json()['id'], 120)
        order = self.client.get('/owner/personal-orders', headers=self.owner).json()[0]
        self.assertEqual(order['status'], 'pending_acceptance')
        self.assertEqual(order['address'], 'Flat 12, Test Road, Pune 411001')
        self.assertTrue(order['customer_name'])
        self.assertTrue(order['customer_phone'])
        self.assertEqual(order['quantity'], 1)
        self.assertEqual(self.client.get('/owner/personal-orders', headers=self.customer).status_code, 403)
        self.assertEqual(self.client.post(f"/owner/personal-orders/{order['plan_id']}/accept", headers=self.owner).status_code, 200)
        accepted_order = self.client.get('/owner/personal-orders', headers=self.owner).json()[0]
        self.assertTrue(accepted_order['accepted'])
        self.assertEqual(accepted_order['address'], order['address'])
        counts = self.client.get('/dashboard/headcount', headers=self.owner).json()['preparation']
        self.assertEqual(next(m for m in counts if m['meal_id'] == lunch['id'])['expected_headcount'], 1)
        self.assertEqual(next(m for m in counts if m['meal_id'] == dinner['id'])['expected_headcount'], 0)
        self.assertEqual(self.client.get('/subscriptions/current', headers=self.customer).json(), [])
        self.assertEqual(self.client.post('/meals/skip', headers=self.customer, json={'meal_id': lunch['id']}).status_code, 403)
        self.assertEqual(self.client.get('/reviews/eligible', headers=self.customer).json(), [])
        with self.Session() as db:
            meal = db.get(models.Meal, lunch['id'])
            meal.date = date.today() - timedelta(days=1)
            p = db.query(models.MealPlan).one()
            p.start_date = p.end_date = meal.date
            db.add(models.DeliveryUpdate(owner_id=self.owner_id, user_id=self.customer_id, meal_id=meal.id, status='delivered', updated_at=datetime.utcnow()-timedelta(days=1)))
            db.commit()
        eligible = self.client.get('/reviews/eligible', headers=self.customer).json()
        self.assertEqual([m['id'] for m in eligible], [lunch['id']])
        r = self.client.post('/reviews', headers=self.customer, json={'meal_id': lunch['id'], 'rating': 4, 'comment': 'Please add more salad'})
        self.assertEqual(r.status_code, 200, r.text)
        feedback = self.client.get('/owner/reviews', headers=self.owner).json()[0]
        self.assertEqual(feedback['rating'], 4)
        self.assertEqual(feedback['comment'], 'Please add more salad')
        self.assertEqual(self.client.get('/customer/activity', headers=self.customer).json()['meals'][0]['rating'], 4)

    def test_checkout_retry_cancel_price_and_ownership(self):
        self.address()
        meal = self.meal(days=0, single_price=100)
        key = str(uuid4())
        body = {'meal_id':meal['id'], 'expected_price':100, 'purchase_key':key}
        r = self.client.post('/customer/checkout', headers=self.customer, json=body)
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(self.client.post('/customer/checkout', headers=self.customer, json=body).json()['id'], r.json()['id'])
        other, _ = self.account('9876543212', 'customer')
        self.assertEqual(self.client.get('/customer/activity', headers=other).json()['purchases'], [])
        self.assertEqual(self.client.delete(f"/customer/checkout/{r.json()['plan_id']}", headers=other).status_code,404)
        self.assertEqual(self.client.delete(f"/customer/checkout/{r.json()['plan_id']}", headers=self.customer).status_code,200)
        self.assertEqual(self.client.post('/payments/submissions', headers=self.customer, data={'bill_id':r.json()['id'], 'amount':100, 'method':'upi'}).status_code,409)
        self.assertEqual(self.buy(meal_id=meal['id'], expected_price=99).status_code,409)
        self.assertEqual(self.buy(meal_id=meal['id'], expected_price=100).status_code,201)

    def test_unpaid_and_undelivered_meals_not_reviewable(self):
        self.address()
        meal = self.meal(days=0, single_price=100)
        r = self.buy(meal_id=meal['id'], expected_price=100)
        with self.Session() as db:
            m = db.get(models.Meal, meal['id']); m.date = date.today()-timedelta(days=1)
            p = db.query(models.MealPlan).one(); p.start_date = p.end_date = m.date
            db.commit()
        self.assertEqual(self.client.get('/reviews/eligible', headers=self.customer).json(), [])
        self.pay(r.json()['id'], 100)
        with self.Session() as db:
            db.add(models.DeliveryUpdate(owner_id=self.owner_id, user_id=self.customer_id, meal_id=meal['id'], status='preparing')); db.commit()
        self.assertEqual(self.client.get('/reviews/eligible', headers=self.customer).json(), [])

    def test_single_price_required_and_booked_meal_cannot_move_or_delete(self):
        self.address()
        meal = self.meal(days=0, single_price=None)
        self.assertEqual(self.buy(meal_id=meal['id'], expected_price=100).status_code,409)
        self.assertEqual(self.client.put(f"/owner/meals/{meal['id']}", headers=self.owner, json={'single_price':-2}).status_code,422)
        self.client.put(f"/owner/meals/{meal['id']}", headers=self.owner, json={'single_price':100})
        r = self.buy(meal_id=meal['id'], expected_price=100)
        self.assertEqual(r.status_code,201,r.text)
        self.assertEqual(self.client.delete(f"/owner/meals/{meal['id']}", headers=self.owner).status_code,400)
        self.assertEqual(self.client.put(f"/owner/meals/{meal['id']}", headers=self.owner, json={'date':(date.today()+timedelta(days=2)).isoformat()}).status_code,409)

    def test_customer_activity_protects_meal_date_and_type(self):
        self.plan()
        meal = self.meal(days=2)
        with self.Session() as db:
            db.add(models.MealOrder(owner_id=self.owner_id, user_id=self.customer_id,
                                    meal_id=meal['id'], status='skipped'))
            db.commit()

        move = {'date': (date.today() + timedelta(days=3)).isoformat()}
        change_type = {'meal_type': 'dinner'}
        move_response = self.client.put(f"/owner/meals/{meal['id']}", headers=self.owner, json=move)
        type_response = self.client.put(f"/owner/meals/{meal['id']}", headers=self.owner, json=change_type)
        self.assertEqual(move_response.status_code, 409, move_response.text)
        self.assertEqual(type_response.status_code, 409, type_response.text)

        menu_response = self.client.put(f"/owner/meals/{meal['id']}", headers=self.owner,
                                        json={'menu_description': 'Updated dal and rice'})
        self.assertEqual(menu_response.status_code, 200, menu_response.text)
        self.assertEqual(menu_response.json()['date'], meal['date'])
        self.assertEqual(menu_response.json()['meal_type'], meal['meal_type'])
        self.assertEqual(menu_response.json()['menu_description'], 'Updated dal and rice')
        self.assertEqual(self.client.delete(f"/owner/meals/{meal['id']}", headers=self.owner).status_code, 400)

    def test_delivery_and_review_history_protect_meal_schedule(self):
        for index, activity in enumerate(('delivery', 'feedback'), start=1):
            with self.subTest(activity=activity):
                meal = self.meal(days=index + 4)
                with self.Session() as db:
                    if activity == 'delivery':
                        db.add(models.DeliveryUpdate(owner_id=self.owner_id, user_id=self.customer_id,
                                                     meal_id=meal['id'], status='preparing'))
                    else:
                        db.add(models.Feedback(owner_id=self.owner_id, user_id=self.customer_id,
                                               meal_id=meal['id'], rating=5))
                    db.commit()
                response = self.client.put(f"/owner/meals/{meal['id']}", headers=self.owner,
                                           json={'date': (date.today() + timedelta(days=index + 5)).isoformat()})
                self.assertEqual(response.status_code, 409, response.text)
                delete_response = self.client.delete(f"/owner/meals/{meal['id']}", headers=self.owner)
                self.assertEqual(delete_response.status_code, 400, delete_response.text)

    def test_owner_can_record_future_checkout_cash_and_other_messes_cannot_access(self):
        self.address()
        offer = self.offer()
        r = self.buy(offer_id=offer['id'], start_date=(date.today()+timedelta(days=2)).isoformat(), expected_price=700)
        self.assertEqual(r.status_code,201,r.text)
        account = self.client.get('/owner/payments', headers=self.owner).json()[0]
        self.assertEqual(account['name'], 'Customer')
        self.assertTrue(account['bill_generated'])
        other_owner, other_id = self.account('9876543213', 'owner')
        foreign_meal = self.client.post('/owner/meals', headers=other_owner, json={'date':(date.today()+timedelta(days=1)).isoformat(), 'meal_type':'lunch', 'single_price':100}).json()
        self.assertEqual(self.buy(meal_id=foreign_meal['id'], expected_price=100).status_code,404)
        self.assertEqual(self.client.get('/owner/payments', headers=other_owner).json(),[])
        self.assertEqual(self.client.get('/owner/reviews', headers=other_owner).json(),[])
        body = {'plan_id':r.json()['plan_id'], 'amount':700, 'receipt_key':str(uuid4()), 'reference':'Cash at counter'}
        self.assertEqual(self.client.post('/owner/payments', headers=other_owner, json=body).status_code,400)
        response = self.client.post('/owner/payments', headers=self.owner, json=body)
        self.assertEqual(response.status_code,201,response.text)
        self.assertEqual(len(self.client.get('/subscriptions/current', headers=self.customer).json()),1)
        self.assertEqual(self.client.get('/customer/activity', headers=self.customer).json()['purchases'][0]['status'],'active')

    def test_checkout_migration_is_idempotent_and_preserves_legacy_data(self):
        from sqlalchemy import create_engine, text, inspect
        from app.migrations import add_customer_checkout
        engine = create_engine('sqlite://')
        with engine.begin() as connection:
            connection.execute(text('CREATE TABLE meals (id INTEGER PRIMARY KEY, menu_description VARCHAR)'))
            connection.execute(text('CREATE TABLE meal_plans (id INTEGER PRIMARY KEY, price NUMERIC(10,2))'))
            connection.execute(text("INSERT INTO meals VALUES (1, 'Dal and roti')"))
            connection.execute(text('INSERT INTO meal_plans VALUES (1, 700)'))
        add_customer_checkout(engine)
        add_customer_checkout(engine)
        with engine.connect() as connection:
            self.assertEqual(connection.execute(text('SELECT menu_description, single_price FROM meals')).one(),('Dal and roti',None))
            self.assertEqual(connection.execute(text('SELECT price, meal_id, purchase_key FROM meal_plans')).one(),(700,None,None))
        engine.dispose()

    def test_single_meal_ordering_accepts_future_meals_and_rejects_past_meals(self):
        self.address()
        upcoming = self.meal(days=2, single_price=100)
        past = self.meal(days=-1, single_price=100)
        result = self.buy(meal_id=past['id'], expected_price=100)
        self.assertEqual(result.status_code, 409, result.text)
        self.assertIn("closed", result.json()['detail'].lower())

        result = self.buy(meal_id=upcoming['id'], expected_price=100)
        self.assertEqual(result.status_code, 201, result.text)
        self.assertEqual(result.json()['status'], 'pending_payment')
        self.assertEqual(result.json()['meal_id'], upcoming['id'])
        self.pay(result.json()['id'], 100)
        order = self.client.get('/owner/personal-orders', headers=self.owner).json()[0]
        self.assertEqual(order['status'], 'pending_acceptance')
        self.assertEqual(order['meal_id'], upcoming['id'])
        accepted = self.client.post(f"/owner/personal-orders/{order['plan_id']}/accept", headers=self.owner)
        self.assertEqual(accepted.status_code, 200, accepted.text)

        today = self.meal(days=0, single_price=100)
        self.assertEqual(self.buy(meal_id=today['id'], expected_price=100).status_code, 201)

    def test_owner_payment_summary_counts_confirmed_receipts(self):
        self.address()
        meal = self.meal(days=1, single_price=100)
        checkout = self.buy(meal_id=meal['id'], expected_price=100)
        self.assertEqual(checkout.status_code, 201, checkout.text)

        summary = self.client.get('/owner/payments/summary', headers=self.owner)
        self.assertEqual(summary.status_code, 200, summary.text)
        self.assertEqual(summary.json(), {'total_received': 0.0, 'payment_count': 0})

        for amount in (40, 60):
            payment = self.client.post('/owner/payments', headers=self.owner, json={
                'plan_id': checkout.json()['plan_id'], 'amount': amount,
                'receipt_key': str(uuid4()),
            })
            self.assertEqual(payment.status_code, 201, payment.text)

        summary = self.client.get('/owner/payments/summary', headers=self.owner)
        self.assertEqual(summary.status_code, 200, summary.text)
        self.assertEqual(summary.json(), {'total_received': 100.0, 'payment_count': 2})
