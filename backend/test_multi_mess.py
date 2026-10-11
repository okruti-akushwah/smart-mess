from datetime import date, timedelta
from uuid import uuid4
from sqlalchemy import create_engine, text
from app import models
from app.migrations import add_mess_ownership
from test_app import ApplicationTests


class MultiMessTests(ApplicationTests):
    def second_owner(self):
        body = {'name': 'Second owner', 'phone': '9999999999', 'password': 'test1234',
                'role': 'owner', 'mess_name': 'Second Kitchen'}
        response = self.client.post('/auth/signup', json=body)
        self.assertEqual(response.status_code, 200, response.text)
        login = self.client.post('/auth/login', json=body)
        headers = {'Authorization': 'Bearer ' + login.json()['access_token']}
        token = self.client.get('/owner/join-link', headers=headers).json()['token']
        return headers, response.json()['id'], token

    def second_offer(self, owner):
        response = self.client.post('/owner/offers', headers=owner, json={
            'name': 'Second weekly plan', 'category': 'regular', 'duration_days': 7,
            'price': 900, 'meal_price': 40, 'description': 'Meals from Second Kitchen'})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def second_customer(self, owner, token, offer):
        body = {'name': 'Second customer', 'phone': '9999999998', 'password': 'test1234',
                'offer_id': offer['id'], 'start_date': date.today().isoformat()}
        response = self.client.post('/join/' + token, json=body)
        self.assertEqual(response.status_code, 201, response.text)
        login = self.client.post('/auth/login', json=body)
        headers = {'Authorization': 'Bearer ' + login.json()['access_token']}
        request = self.client.get('/owner/join-requests', headers=owner).json()[0]
        return headers, request, body

    def test_multiple_registration_and_public_catalogues(self):
        first_offer = self.offer()
        first_meal = self.meal(days=0)
        first_token = self.client.get('/owner/join-link', headers=self.owner).json()['token']
        other, other_id, token = self.second_owner()
        second_offer = self.second_offer(other)
        response = self.client.post('/owner/meals', headers=other, json={
            'date': date.today().isoformat(), 'meal_type': 'lunch', 'menu_description': 'Second kitchen menu'})
        self.assertEqual(response.status_code, 201, response.text)
        second_meal = response.json()
        for invite, meal, offer in [(first_token, first_meal, first_offer), (token, second_meal, second_offer)]:
            for path, expected in [('/public/menu', meal['id']), ('/public/plans', offer['id'])]:
                result = self.client.get(path, params={'mess_token': invite})
                self.assertEqual(result.status_code, 200, result.text)
                self.assertEqual([item['id'] for item in result.json()], [expected])
        self.assertEqual(self.client.get('/public/mess/' + token).json()['name'], 'Second Kitchen')
        self.assertEqual(len(self.client.get('/public/messes').json()), 2)
        self.assertTrue(self.client.get('/auth/registration-status').json()['setup_available'])
        self.assertEqual(self.client.get('/public/plans', headers=other).json()[0]['id'], second_offer['id'])
        self.assertEqual(self.client.get('/public/menu', params={'mess_token': 'invalid'}).status_code, 404)
        self.assertEqual(self.client.put('/owner/meals/' + str(first_meal['id']), headers=other, json={'menu_description': 'Tampered'}).status_code, 404)
        self.assertEqual(self.client.delete('/owner/offers/' + str(first_offer['id']), headers=other).status_code, 404)
        with self.Session() as db:
            self.assertEqual(db.get(models.Meal, second_meal['id']).owner_id, other_id)
            self.assertEqual(db.get(models.PlanOffer, second_offer['id']).owner_id, other_id)

    def test_customer_join_approval_and_plan_isolation(self):
        first_offer = self.offer()
        other, other_id, token = self.second_owner()
        offer = self.second_offer(other)
        customer, request, body = self.second_customer(other, token, offer)
        endpoint = '/owner/join-requests/' + str(request['id'])
        self.assertEqual(self.client.get('/meals/upcoming', headers=customer).status_code, 403)
        self.assertEqual(self.client.patch(endpoint, headers=self.owner, json={'status': 'approved'}).status_code, 404)
        self.assertEqual(self.client.get('/owner/join-requests', headers=self.owner).json(), [])
        self.assertEqual(self.client.post('/join/' + token, json={**body, 'offer_id': first_offer['id']}).status_code, 422)
        self.assertEqual(self.client.patch(endpoint, headers=other, json={'status': 'approved'}).status_code, 200)
        self.assertEqual(self.client.get('/join-status', headers=customer).json()['status'], 'approved')
        current = self.client.get('/subscriptions/current', headers=customer).json()[0]
        self.assertEqual(current['name'], offer['name'])
        self.assertEqual(self.client.get('/owner/customers', headers=self.owner).json()[0]['id'], self.customer_id)
        users = self.client.get('/owner/customers', headers=other).json()
        self.assertEqual([u['name'] for u in users], ['Second customer'])
        self.assertEqual(self.client.post('/owner/plans', headers=self.owner, json={
            'user_id': users[0]['id'], 'price': 3000, 'meal_price': 50,
            'start_date': date.today().isoformat(), 'end_date': (date.today()+timedelta(days=30)).isoformat()}).status_code, 404)
        self.assertEqual(self.client.post('/owner/bills/' + str(current['id']), headers=self.owner).status_code, 404)
        self.assertEqual(self.client.post('/subscriptions/requests', headers=customer,
            json={'offer_id': first_offer['id'], 'start_date': (date.today()+timedelta(days=10)).isoformat()}).status_code, 404)
        first_token = self.client.get('/owner/join-link', headers=self.owner).json()['token']
        self.assertEqual(self.client.post('/join/' + first_token, json={**body, 'offer_id': first_offer['id']}).status_code, 409)
        with self.Session() as db:
            self.assertEqual(db.get(models.User, users[0]['id']).mess_owner_id, other_id)

    def test_billing_delivery_and_settings_stay_with_the_mess(self):
        self.plan()
        first_meal = self.meal(days=0)
        other, _, token = self.second_owner()
        offer = self.second_offer(other)
        customer, request, _ = self.second_customer(other, token, offer)
        self.client.patch('/owner/join-requests/' + str(request['id']), headers=other, json={'status': 'approved'})
        meal = self.client.post('/owner/meals', headers=other, json={
            'date': date.today().isoformat(), 'meal_type': 'lunch', 'menu_description': 'Second lunch'}).json()
        self.assertEqual([m['id'] for m in self.client.get('/meals/today', headers=customer).json()], [meal['id']])
        self.assertEqual(self.client.post('/meals/skip', headers=customer, json={'meal_id': first_meal['id']}).status_code, 404)
        for owner, price, payee in [(self.owner, 25, 'First'), (other, 80, 'Second')]:
            self.assertEqual(self.client.put('/owner/guest-price', headers=owner, json={'price': price}).status_code, 200)
            self.assertEqual(self.client.put('/owner/payment-methods', headers=owner, json={'payee_name': payee}).status_code, 200)
        self.assertEqual(self.client.get('/meals/guest-price', headers=customer).json()['price'], 80)
        self.assertEqual(self.client.get('/payments/methods', headers=self.customer).json()['payee_name'], 'First')
        self.assertEqual(self.client.get('/payments/methods', headers=customer).json()['payee_name'], 'Second')
        users = self.client.get('/owner/customers', headers=other).json()
        self.assertEqual(self.client.put('/delivery/address', headers=customer, json={'address': '42 Second Kitchen Road'}).status_code, 200)
        rows = self.client.get('/owner/deliveries', headers=other).json()
        self.assertEqual([(r['user_id'], r['meal_id']) for r in rows], [(users[0]['id'], meal['id'])])
        self.assertEqual(self.client.put('/owner/deliveries', headers=self.owner, json={
            'user_id': users[0]['id'], 'meal_id': meal['id'], 'status': 'preparing'}).status_code, 400)
        balances = self.client.get('/owner/payments', headers=other).json()
        self.assertEqual([b['user_id'] for b in balances], [users[0]['id']])
        plan_id = balances[0]['plan_id']
        bill = self.client.post('/owner/bills/' + str(plan_id), headers=other)
        self.assertEqual(bill.status_code, 201, bill.text)
        submission = self.client.post('/payments/submissions', headers=customer, data={
            'bill_id': bill.json()['id'], 'amount': 100, 'method': 'upi'}, files={'file':('proof.png', b'\x89PNG\r\n\x1a\n' + b'0'*40 + b'IEND\xaeB`\x82', 'image/png')})
        self.assertEqual(submission.status_code, 201, submission.text)
        row = self.client.get('/payments/submissions', headers=other).json()[0]
        self.assertEqual(self.client.get('/payments/submissions', headers=self.owner).json(), [])
        self.assertEqual(self.client.patch('/owner/payment-submissions/' + str(row['id']), headers=self.owner, json={'status': 'approved'}).status_code, 404)
        self.assertEqual(self.client.patch('/owner/payment-submissions/' + str(row['id']), headers=other, json={'status': 'approved'}).status_code, 200)
        self.assertEqual(self.client.get('/bills/current', headers=customer).json()['amount_paid'], 100)
        self.assertEqual(self.client.post('/owner/payments', headers=self.owner, json={
            'plan_id': plan_id, 'amount': 10, 'reference': '', 'receipt_key': str(uuid4())}).status_code, 400)
        self.assertEqual(self.client.post('/owner/customers', headers=self.owner, json={
            'name': 'Duplicate', 'phone': '9999999998', 'password': 'test1234'}).status_code, 409)

    def test_legacy_ownership_migration_is_idempotent(self):
        engine = create_engine('sqlite://')
        Base = models.Base
        Base.metadata.create_all(engine)
        with engine.begin() as connection:
            connection.execute(text("INSERT INTO users (id, name, phone, password_hash, role) VALUES (7, 'Owner', '9876543200', 'hash', 'owner'), (8, 'Customer', '9876543201', 'hash', 'customer')"))
            connection.execute(text("INSERT INTO mess_installation (id, owner_id) VALUES (1, 7)"))
            connection.execute(text("INSERT INTO meals (id, date, meal_type) VALUES (9, '2026-10-09', 'lunch')"))
            connection.execute(text("INSERT INTO meal_plans (id, user_id, price) VALUES (10, 8, 1000)"))
            connection.execute(text("INSERT INTO payment_settings (id, payee_name) VALUES (1, 'Original owner')"))
        add_mess_ownership(engine)
        add_mess_ownership(engine)
        with engine.connect() as connection:
            self.assertEqual(connection.execute(text('SELECT mess_owner_id FROM users WHERE id=8')).scalar(), 7)
            self.assertEqual(connection.execute(text('SELECT owner_id FROM meals WHERE id=9')).scalar(), 7)
            self.assertEqual(connection.execute(text('SELECT owner_id FROM meal_plans WHERE id=10')).scalar(), 7)
            self.assertEqual(connection.execute(text('SELECT payee_name FROM payment_settings WHERE owner_id=7')).scalar(), 'Original owner')
        engine.dispose()
