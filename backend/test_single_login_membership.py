from datetime import date
from uuid import uuid4
from test_app import ApplicationTests
from app import models


class SingleLoginMembershipTests(ApplicationTests):
    def test_common_signup_and_login_without_a_mess(self):
        body = {'name': 'Platform customer', 'phone': '9876543277',
                'password': 'newpass123', 'role': 'customer'}
        registered = self.client.post('/auth/signup', json=body)
        self.assertEqual(registered.status_code, 200, registered.text)
        login = self.client.post('/auth/login', json={
            'phone': body['phone'], 'password': body['password']})
        self.assertEqual(login.status_code, 200, login.text)
        headers = {'Authorization': 'Bearer ' + login.json()['access_token']}
        self.assertEqual(self.client.get('/customer/messes', headers=headers).json(), [])
        self.assertEqual(self.client.get('/customer/account-activity', headers=headers).json()['purchases'], [])
        self.assertEqual(self.client.post('/auth/signup', json=body).status_code, 409)
        with self.Session() as db:
            user = db.query(models.User).filter_by(phone=body['phone']).one()
            self.assertEqual(user.id, registered.json()['id'])
            self.assertIsNone(user.mess_owner_id)

    def test_join_another_mess_preserves_original_and_orders_after_approval(self):
        other, other_id = self.account('9876543299', 'owner')
        token = self.client.get('/owner/join-link', headers=other).json()['token']
        selected = {**self.customer, 'X-Mess-Token': token}
        meal = self.client.post('/owner/meals', headers=other, json={
            'date': date.today().isoformat(), 'meal_type': 'lunch',
            'menu_description': 'Mess C lunch', 'single_price': 120}).json()
        checkout = {'purchase_key': str(uuid4()), 'meal_id': meal['id'], 'expected_price': 120}
        self.assertEqual(self.client.post('/customer/checkout', headers=selected, json=checkout).status_code, 403)
        for _ in range(2):
            response = self.client.post(f'/join/{token}/request', headers=self.customer, json={})
            self.assertEqual(response.status_code, 200, response.text)
        memberships = self.client.get('/customer/messes', headers=self.customer).json()
        self.assertEqual({m['owner_id']: m['status'] for m in memberships},
                         {self.owner_id: 'approved', other_id: 'pending'})
        original = next(m for m in memberships if m['owner_id'] == self.owner_id)
        self.assertEqual(self.client.get('/meals/upcoming', headers={**self.customer,
            'X-Mess-Token': original['join_token']}).status_code, 200)
        self.assertEqual(self.client.post('/customer/checkout', headers=selected, json=checkout).status_code, 403)
        requests = self.client.get('/owner/join-requests', headers=other).json()
        self.assertEqual(len(requests), 1)
        approved = self.client.patch(f"/owner/join-requests/{requests[0]['id']}",
                                    headers=other, json={'status': 'approved'})
        self.assertEqual(approved.status_code, 200, approved.text)
        self.assertEqual(self.client.get('/join-status', headers=selected).json()['status'], 'approved')
        address = self.client.put('/delivery/address', headers=selected,
            json={'address': 'Flat 12, Test Road, Pune 411001'})
        self.assertEqual(address.status_code, 200, address.text)
        purchase = self.client.post('/customer/checkout', headers=selected, json=checkout)
        self.assertEqual(purchase.status_code, 201, purchase.text)
        self.assertEqual(self.client.get('/customer/activity', headers={**self.customer,
            'X-Mess-Token': original['join_token']}).json()['purchases'], [])
        original_meal = self.meal(single_price=50)
        original_headers = {**self.customer, 'X-Mess-Token': original['join_token']}
        original_purchase = self.client.post('/customer/checkout', headers=original_headers,
            json={'purchase_key': str(uuid4()), 'meal_id': original_meal['id'], 'expected_price': 50})
        self.assertEqual(original_purchase.status_code, 201, original_purchase.text)
        history = self.client.get('/customer/account-activity', headers=selected)
        self.assertEqual(history.status_code, 200, history.text)
        self.assertEqual({row['owner_id'] for row in history.json()['purchases']}, {self.owner_id, other_id})
        self.assertEqual(len(history.json()['purchases']), 2)
        stranger, _ = self.account('9876543288', 'customer')
        self.assertEqual(self.client.get('/customer/account-activity', headers=stranger).json()['purchases'], [])
        self.assertEqual(self.client.get('/customer/account-activity', headers=other).status_code, 403)
        self.assertEqual(self.client.get('/customer/account-activity').status_code, 401)
        self.assertEqual(self.client.post('/customer/checkout', headers=selected,
            json={'purchase_key': str(uuid4()), 'meal_id': original_meal['id'], 'expected_price': 50}).status_code, 404)
        with self.Session() as db:
            self.assertEqual(db.query(models.User).filter_by(phone='9876543211').count(), 1)
