import test_app
from datetime import date, timedelta
from app import models

class WorkflowTests(test_app.ApplicationTests):
    def test_legacy_owner_customer_payment_workflow(self):
        created = self.client.post('/owner/customers', headers=self.owner, json={'name':'New Customer','phone':'9876543222','password':'hello123'})
        self.assertEqual(created.status_code, 201, created.text)
        self.assertNotIn('password_hash', created.json())
        self.assertEqual(self.client.post('/owner/customers', headers=self.customer, json={'name':'X','phone':'9876543223','password':'hello123'}).status_code, 403)
        self.assertEqual(self.client.post('/owner/customers', headers=self.owner, json={'name':'X','phone':'9876543222','password':'hello123'}).status_code, 409)
        login = self.client.post('/auth/login', json={'phone':'9876543222','password':'hello123'})
        new_user = {'Authorization':'Bearer '+login.json()['access_token']}
        with self.Session() as db:
            legacy = models.MealPlan(owner_id=self.owner_id, user_id=created.json()['id'], price=3000, meal_price=50,
                plan_type='monthly', start_date=date.today(), end_date=date.today()+timedelta(days=30), status='active')
            db.add(legacy); db.commit(); plan = legacy.id
        meal = self.meal(days=0)
        dinner = self.meal(days=0, meal_type='dinner', single_price=75)
        self.assertTrue(any(m['id']==meal['id'] for m in self.client.get('/meals/today', headers=new_user).json()))
        self.assertEqual(self.client.post('/meals/skip', headers=new_user, json={'meal_id':meal['id']}).status_code, 200)
        self.assertEqual(self.client.put('/owner/guest-price', headers=self.owner, json={'price':75}).status_code, 200)
        self.assertEqual(self.client.post('/meals/add-guest', headers=new_user, json={'meal_id':dinner['id'],'extra_cost':75}).status_code, 200)
        self.assertEqual(self.client.get('/bills/current', headers=new_user).json()['final_amount'],3075)
        self.assertFalse(next(a for a in self.client.get('/owner/payments',headers=self.owner).json() if a['plan_id'] == plan)['bill_generated'])
        issued = self.client.post(f'/owner/bills/{plan}',headers=self.owner)
        self.assertEqual(issued.status_code,201,issued.text)
        bill = issued.json()['id']
        account = next(a for a in self.client.get('/owner/payments',headers=self.owner).json() if a['plan_id'] == plan)
        self.assertTrue(account['bill_generated'])
        self.assertEqual(account['issued_bill_id'], bill)
        self.assertEqual(self.client.post(f'/owner/bills/{plan}',headers=self.owner).json()['id'],bill)
        self.assertEqual(self.client.get('/bills/issued',headers=new_user).json()[0]['seen'],False)
        self.assertEqual(self.client.get('/bills/issued',headers=self.customer).json(),[])
        self.assertEqual(self.client.post(f'/bills/issued/{bill}/seen',headers=self.customer).status_code,404)
        self.assertEqual(self.client.post(f'/bills/issued/{bill}/seen',headers=new_user).status_code,200)
        body={'bill_id':bill,'amount':'1000','method':'upi','reference':'TX123'}
        self.assertEqual(self.client.post('/payments/submissions',headers=new_user,data=body).status_code,422)
        png = b'\x89PNG\r\n\x1a\n' + b'0'*40 + b'IEND\xaeB`\x82'
        r = self.client.post('/payments/submissions',headers=new_user,data=body,files={'file':('proof.png',png,'image/png')})
        self.assertEqual(r.status_code,201,r.text)
        sub=self.client.get('/payments/submissions',headers=self.owner).json()[0]['id']
        self.assertEqual(self.client.get(f'/payments/submissions/{sub}/image',headers=self.customer).status_code,404)
        self.assertEqual(self.client.get(f'/payments/submissions/{sub}/image',headers=self.owner).content,png)
        self.assertEqual(self.client.post('/payments/submissions',headers=new_user,data=body,files={'file':('proof.png',png,'image/png')}).status_code,409)
        self.assertEqual(self.client.get('/bills/current',headers=new_user).json()['amount_paid'],0)
        self.assertEqual(self.client.patch(f'/owner/payment-submissions/{sub}',headers=new_user,json={'status':'approved'}).status_code,403)
        for _ in range(2):
            self.assertEqual(self.client.patch(f'/owner/payment-submissions/{sub}',headers=self.owner,json={'status':'approved'}).status_code,200)
        self.assertEqual(self.client.get('/bills/current',headers=new_user).json()['balance_due'],2075)
        self.assertEqual(len(self.client.get('/payments/history',headers=new_user).json()),1)
        self.assertEqual(self.client.post('/payments/submissions',headers=new_user,data={**body,'amount':'2075'},files={'file':('proof.png',png,'image/png')}).status_code,201)
        sub2=self.client.get('/payments/submissions',headers=self.owner).json()[0]['id']
        self.assertEqual(self.client.patch(f'/owner/payment-submissions/{sub2}',headers=self.owner,json={'status':'rejected'}).status_code,200)
        self.assertEqual(self.client.post('/payments/submissions',headers=new_user,data={**body,'amount':'2075'},files={'file':('proof.png',png,'image/png')}).status_code,201)
        sub3=self.client.get('/payments/submissions',headers=self.owner).json()[0]['id']
        # Generated bills can still be settled after subscription expiry.
        with self.Session() as db:
            db.get(models.MealPlan,plan).end_date=date.today()-timedelta(days=1)
            db.commit()
        self.assertEqual(self.client.patch(f'/owner/payment-submissions/{sub3}',headers=self.owner,json={'status':'approved'}).status_code,200)
        self.assertEqual(self.client.get('/bills/issued',headers=new_user).json()[0]['balance_due'],0)
        from app.routes.workflow_routes import PROOF_DIR
        with self.Session() as db:
            for item in db.query(models.PaymentSubmission).all():
                if item.image_name:
                    (PROOF_DIR/item.image_name).unlink(missing_ok=True)

    def test_owner_assignment_requires_full_approved_qr_payment(self):
        meal = self.meal(days=0)
        response = self.client.post('/owner/plans', headers=self.owner, json={
            'user_id': self.customer_id, 'price': 1200, 'meal_price': 50,
            'start_date': date.today().isoformat(), 'end_date': (date.today()+timedelta(days=10)).isoformat()})
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()['status'], 'pending_payment')
        self.assertEqual(self.client.get('/subscriptions/current', headers=self.customer).json(), [])
        self.assertEqual(self.client.get('/dashboard/headcount', headers=self.owner).json()['preparation'][0]['expected_headcount'], 0)
        bill = self.client.get('/bills/issued', headers=self.customer).json()[0]['id']
        png = b'\x89PNG\r\n\x1a\n' + b'0'*40 + b'IEND\xaeB`\x82'
        for amount, active in [(200, False), (1000, True)]:
            paid = self.client.post('/payments/submissions', headers=self.customer,
                data={'bill_id': bill, 'amount': amount, 'method': 'upi'}, files={'file': ('proof.png', png, 'image/png')})
            self.assertEqual(paid.status_code, 201, paid.text)
            self.assertEqual(self.client.get('/subscriptions/current', headers=self.customer).json(), [])
            submission = self.client.get('/payments/submissions', headers=self.owner).json()[0]['id']
            approved = self.client.patch(f'/owner/payment-submissions/{submission}', headers=self.owner, json={'status': 'approved'})
            self.assertEqual(approved.status_code, 200, approved.text)
            self.assertEqual(bool(self.client.get('/subscriptions/current', headers=self.customer).json()), active)
        counts = self.client.get('/dashboard/headcount', headers=self.owner).json()['preparation']
        self.assertEqual(next(m for m in counts if m['meal_id'] == meal['id'])['expected_headcount'], 1)
        from app.routes.workflow_routes import PROOF_DIR
        with self.Session() as db:
            for item in db.query(models.PaymentSubmission).all():
                if item.image_name:
                    (PROOF_DIR/item.image_name).unlink(missing_ok=True)

