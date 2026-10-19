from datetime import date, timedelta, datetime, timezone
from decimal import Decimal
from uuid import uuid4
import unittest
import test_app
from app import models


class ALaCarteTests(unittest.TestCase):
    setUp = test_app.ApplicationTests.setUp
    tearDown = test_app.ApplicationTests.tearDown
    account = test_app.ApplicationTests.account
    meal = test_app.ApplicationTests.meal

    def booking(self, single=False):
        meal = self.meal(days=1)
        with self.Session() as db:
            db.add(models.DeliveryProfile(user_id=self.customer_id, owner_id=self.owner_id, address='42 Test Road, Test City'))
            plan = models.MealPlan(owner_id=self.owner_id, user_id=self.customer_id, price=1000,
                meal_price=50, plan_type='Test plan', meal_types=['lunch'], status='active', accepted=True,
                meal_id=meal['id'] if single else None, purchase_key=str(uuid4()) if single else None,
                start_date=date.today(), end_date=date.today()+timedelta(days=5))
            db.add(plan); db.flush()
            db.add(models.PaymentRecord(owner_id=self.owner_id, plan_id=plan.id, amount=1000, receipt_key=str(uuid4())))
            db.commit(); plan_id = plan.id
        return meal, plan_id

    def item(self, **changes):
        payload = {'name':'Extra roti', 'name_hi':'अतिरिक्त रोटी', 'description':'Fresh roti',
                   'price':'20.00', 'meal_types':['lunch'], 'available':True, **changes}
        r = self.client.post('/owner/a-la-carte/items', headers=self.owner, json=payload)
        self.assertEqual(r.status_code,201,r.text)
        return r.json()

    def order_body(self, meal, plan, item, **changes):
        return {'meal_id':meal['id'], 'plan_id':plan, 'purchase_key':str(uuid4()),
                'lines':[{'item_id':item['id'], 'quantity':2, 'expected_unit_price':'20.00'}], **changes}

    def submit(self, body):
        return self.client.post('/customer/a-la-carte/orders', headers=self.customer, json=body)

    def test_itemized_bill_retry_and_snapshots(self):
        meal, plan = self.booking(); item = self.item(); body = self.order_body(meal,plan,item)
        before = self.client.post(f'/owner/bills/{plan}',headers=self.owner).json()
        result = self.submit(body)
        self.assertEqual(result.status_code,201,result.text)
        self.assertEqual(result.json()['total'],40)
        bill = self.client.get('/bills/issued',headers=self.customer).json()[0]
        self.assertEqual((bill['final_amount'],bill['balance_due']), (1040,40))
        self.assertEqual(bill['extra_lines'][0]['quantity'],2)
        self.assertEqual(self.client.get('/bills/current',headers=self.customer).json()['extras_total'],40)
        self.assertEqual(self.submit(body).json()['id'],result.json()['id'])
        self.assertEqual(self.submit({**body,'lines':[{**body['lines'][0],'quantity':3}]}).status_code,409)
        self.client.put(f'/owner/a-la-carte/items/{item["id"]}',headers=self.owner,
            json={**item,'price':'30.00','name':'Changed name','available':False})
        self.assertEqual(self.submit(body).json()['id'],result.json()['id'])
        bills = self.client.get('/bills/issued',headers=self.customer).json()
        self.assertEqual(next(b for b in bills if b['id']==before['id'])['extra_lines'],[])
        self.assertEqual(bills[0]['extra_lines'][0]['name'],'Extra roti')
        self.assertEqual(len(self.client.get('/customer/a-la-carte/orders',headers=self.customer).json()),1)

    def test_stale_price_validation_and_tenancy(self):
        meal, plan = self.booking(); item = self.item(); body = self.order_body(meal,plan,item)
        self.assertEqual(self.submit({**body,'lines':[{**body['lines'][0],'expected_unit_price':'1'}]}).status_code,409)
        for lines in ([], [body['lines'][0],body['lines'][0]], [{**body['lines'][0],'quantity':0}], [{**body['lines'][0],'quantity':1.5}]):
            self.assertEqual(self.submit({**body,'lines':lines}).status_code,422)
        other, _ = self.account('9876543229','owner')
        foreign = self.client.post('/owner/a-la-carte/items',headers=other,json={'name':'Other','price':20,'meal_types':['lunch']}).json()
        self.assertEqual(self.submit({**body,'lines':[{**body['lines'][0],'item_id':foreign['id']}]}).status_code,404)
        self.assertEqual(self.client.get('/owner/a-la-carte/items',headers=self.customer).status_code,403)
        self.assertEqual(self.client.get('/customer/a-la-carte/orders',headers=other).status_code,403)
        self.assertEqual(self.client.get('/customer/a-la-carte/orders',headers=self.customer).json(),[])

    def test_guests_headcounts_skip_pause_and_preparation(self):
        meal, plan = self.booking(); item = self.item()
        guest = self.client.post('/meals/add-guest',headers=self.customer,json={'meal_id':meal['id'],'guest_count':1})
        self.assertEqual(guest.status_code,200,guest.text)
        self.assertEqual(self.submit(self.order_body(meal,plan,item)).status_code,201)
        self.assertEqual(self.client.get('/bills/current',headers=self.customer).json()['extras_total'],90)
        counts = self.client.get('/dashboard/headcount',headers=self.owner).json()['preparation'][0]
        self.assertEqual(counts['expected_headcount'],2)
        self.assertEqual(counts['extra_items'][0]['quantity'],2)
        self.assertEqual(self.client.post('/meals/skip',headers=self.customer,json={'meal_id':meal['id']}).status_code,409)
        pause = self.client.post('/subscriptions/pause',headers=self.customer,
            json={'start_date':meal['date'],'end_date':meal['date']})
        self.assertEqual(pause.status_code,409,pause.text)
        self.assertIn(self.client.delete(f'/owner/meals/{meal["id"]}',headers=self.owner).status_code,(400,409))

    def test_eligibility_and_single_meal(self):
        meal, plan = self.booking(single=True); item = self.item()
        catalogue = self.client.get(f'/customer/a-la-carte/items?meal_id={meal["id"]}',headers=self.customer)
        self.assertEqual(catalogue.status_code,200,catalogue.text)
        self.assertEqual(catalogue.json()['plan_id'],plan)
        result = self.submit(self.order_body(meal,plan,item))
        self.assertEqual(result.status_code,201,result.text)
        self.assertEqual(self.client.get('/bills/issued',headers=self.customer).json()[0]['balance_due'],40)
        with self.Session() as db:
            db.get(models.MealPlan,plan).accepted=False
            db.commit()
        self.assertEqual(self.submit(self.order_body(meal,plan,item)).status_code,409)

    def test_cutoff_dispatch_address_and_pause_guards(self):
        meal, plan = self.booking(); item = self.item(); body=self.order_body(meal,plan,item)
        with self.Session() as db:
            db.get(models.Meal,meal['id']).cutoff_time=datetime.now(timezone.utc)-timedelta(minutes=1)
            db.commit()
        self.assertEqual(self.submit(body).status_code,409)
        with self.Session() as db:
            db.get(models.Meal,meal['id']).cutoff_time=None
            db.add(models.MealDatePause(owner_id=self.owner_id,user_id=self.customer_id,plan_id=plan,date=date.fromisoformat(meal['date']),active=True))
            db.commit()
        self.assertEqual(self.submit(body).status_code,409)
        with self.Session() as db:
            db.query(models.MealDatePause).delete()
            db.get(models.DeliveryProfile,self.customer_id).address=''
            db.commit()
        self.assertEqual(self.submit(body).status_code,409)

    def test_extra_payment_and_receipt(self):
        meal, plan=self.booking(); item=self.item()
        result=self.submit(self.order_body(meal,plan,item))
        self.assertEqual(result.status_code,201,result.text)
        paid=self.client.post('/owner/payments',headers=self.owner,json={'plan_id':plan,'amount':40,'receipt_key':str(uuid4())})
        self.assertEqual(paid.status_code,201,paid.text)
        self.assertEqual(self.client.get('/bills/issued',headers=self.customer).json()[0]['balance_due'],0)
        with self.Session() as db:
            receipt=db.query(models.PaymentRecord).filter_by(plan_id=plan).order_by(models.PaymentRecord.id.desc()).first().id
            self.assertEqual(db.get(models.MealPlan,plan).price,Decimal('1000'))
        html=self.client.get(f'/payments/receipts/{receipt}',headers=self.customer)
        self.assertIn('Extra roti',html.text)

    def test_pending_proof_is_not_payment_and_stale_bill_is_rejected(self):
        meal, plan=self.booking(); item=self.item()
        old=self.client.post(f'/owner/bills/{plan}',headers=self.owner).json()['id']
        result=self.submit(self.order_body(meal,plan,item))
        self.assertEqual(result.status_code,201,result.text)
        latest=result.json()['bill_id']
        png=b'\x89PNG\r\n\x1a\n'+b'0'*40+b'IEND\xaeB`\x82'
        def proof(bill):
            return self.client.post('/payments/submissions',headers=self.customer,
                data={'bill_id':bill,'amount':40,'method':'upi'},files={'file':('proof.png',png,'image/png')})
        self.assertEqual(proof(old).status_code,409)
        self.assertEqual(proof(latest).status_code,201)
        self.assertEqual(self.client.get('/bills/issued',headers=self.customer).json()[0]['balance_due'],40)
        review=self.client.get('/payments/submissions',headers=self.owner).json()[0]['id']
        self.assertEqual(self.client.patch(f'/owner/payment-submissions/{review}',headers=self.owner,json={'status':'approved'}).status_code,200)
        self.assertEqual(self.client.get('/bills/issued',headers=self.customer).json()[0]['balance_due'],0)

    def test_extension_cannot_move_a_later_booking_away_from_its_extras(self):
        from app.subscription_extensions import change_extension
        from fastapi import HTTPException
        meal,plan=self.booking();item=self.item()
        self.assertEqual(self.submit(self.order_body(meal,plan,item)).status_code,201)
        with self.Session() as db:
            current=db.get(models.MealPlan,plan)
            earlier=models.MealPlan(owner_id=self.owner_id,user_id=self.customer_id,price=1000,meal_price=50,
                start_date=date.today()-timedelta(days=3),end_date=date.today()-timedelta(days=1),status='active',meal_types=['lunch'])
            db.add(earlier);db.commit()
            # Extending the earlier booking by three days would move the existing meal outside its plan.
            with self.assertRaises(HTTPException):
                change_extension(db,earlier,3)
