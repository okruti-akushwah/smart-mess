import os
import unittest
from datetime import date, datetime, timedelta, timezone
os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['SIGNUP_OTP_MODE'] = 'off'
os.environ['SECRET_KEY'] = 'isolated-test-secret-not-for-production'
from sqlalchemy.pool import StaticPool
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, get_db
from app import models

class ApplicationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        def database():
            with self.Session() as db:
                yield db
        app.dependency_overrides[get_db] = database
        self.client = TestClient(app)
        self.owner, self.owner_id = self.account('9876543210', 'owner')
        self.customer, self.customer_id = self.account('9876543211', 'customer')

    def tearDown(self):
        app.dependency_overrides.clear()
        self.engine.dispose()

    def account(self, phone, role):
        from app import auth
        with self.Session() as db:
            user = models.User(name=role.title(), phone=phone, password_hash=auth.hash_password('test1234'), role=role,
                               mess_owner_id=getattr(self, 'owner_id', None) if role == 'customer' else None)
            db.add(user)
            db.commit()
            user_id = user.id
        login = self.client.post('/auth/login', json={'phone': phone, 'password': 'test1234'})
        self.assertEqual(login.status_code, 200, login.text)
        return {'Authorization': 'Bearer ' + login.json()['access_token']}, user_id

    def meal(self, days=1, meal_type='lunch', **extra):
        body = {'date': (date.today()+timedelta(days=days)).isoformat(), 'meal_type': meal_type, 'menu_description': 'Dal, rice and roti', 'single_price': 50, **extra}
        r = self.client.post('/owner/meals', headers=self.owner, json=body)
        self.assertEqual(r.status_code, 201, r.text)
        return r.json()

    def plan(self):
        # Existing meal/billing tests exercise a legacy active subscription.
        # New owner assignments and their payment gate have separate regression tests.
        with self.Session() as db:
            db.add(models.MealPlan(owner_id=self.owner_id, user_id=self.customer_id,
                plan_type='monthly', price=3000, meal_price=50, status='active',
                start_date=date.today(), end_date=date.today()+timedelta(days=31)))
            db.commit()

    def test_auth_validation_and_permissions(self):
        self.assertEqual(self.client.get('/owner/meals').status_code, 401)
        self.assertEqual(self.client.get('/owner/meals', headers=self.customer).status_code, 403)
        self.assertEqual(self.client.post('/auth/login', json={'phone':'9876543210','password':'wrong'}).status_code, 401)
        self.assertEqual(self.client.post('/auth/signup', json={'name':'X','phone':'123','password':'1','role':'admin'}).status_code, 422)
        oauth = self.client.post('/auth/token', data={'username':'9876543210','password':'test1234'})
        self.assertEqual(oauth.status_code, 200)

    def offer(self, **extra):
        body = {'name': 'Weekly regular', 'category': 'regular', 'duration_days': 7,
                'price': 700, 'meal_price': 35, 'description': 'All scheduled meals for seven days', **extra}
        r = self.client.post('/owner/offers', headers=self.owner, json=body)
        self.assertEqual(r.status_code, 201, r.text)
        return r.json()

    def test_catalogue_request_approval_and_permissions(self):
        offer = self.offer()
        self.assertEqual(self.client.post('/owner/offers', headers=self.customer, json={}).status_code, 403)
        self.assertEqual(self.client.get('/public/plans').json()[0]['price'], 700)
        body = {'offer_id': offer['id'], 'start_date': date.today().isoformat()}
        self.assertEqual(self.client.post('/subscriptions/requests', headers=self.customer, json=body).status_code, 201)
        self.assertEqual(self.client.post('/subscriptions/requests', headers=self.customer, json=body).status_code, 400)
        req = self.client.get('/owner/requests', headers=self.owner).json()[0]
        url = f'/subscriptions/requests/{req["id"]}'
        self.assertEqual(self.client.patch(url, headers=self.customer, json={'status':'approved'}).status_code, 403)
        other, _ = self.account('9876543212', 'customer')
        self.assertEqual(self.client.patch(url, headers=other, json={'status':'cancelled'}).status_code, 404)
        self.assertEqual(self.client.patch(url, headers=self.owner, json={'status':'approved'}).status_code, 200)
        self.assertEqual(self.client.patch(url, headers=self.owner, json={'status':'approved'}).status_code, 400)
        current = self.client.get('/subscriptions/current', headers=self.customer).json()[0]
        self.assertEqual(current['end_date'], (date.today()+timedelta(days=6)).isoformat())
        self.assertEqual(self.client.get('/bills/current', headers=self.customer).json()['base_amount'], 700)
        self.assertEqual(self.client.post('/subscriptions/requests', headers=self.customer, json=body).status_code, 400)
        self.assertEqual(self.client.delete(f'/owner/offers/{offer["id"]}', headers=self.owner).status_code, 409)
        self.assertEqual(self.client.get('/owner/offers', headers=self.owner).json()[0]['assigned_count'], 1)
        self.assertEqual(len(self.client.get('/public/plans').json()), 1)
        with self.Session() as db:
            plan = db.query(models.MealPlan).one()
            self.assertEqual(plan.offer_id, offer['id'])
            plan.end_date = date.today() - timedelta(days=1)
            db.commit()
        self.assertEqual(self.client.delete(f'/owner/offers/{offer["id"]}', headers=self.owner).status_code, 200)
        self.assertEqual(self.client.get('/public/plans').json(), [])

    def test_unpublish_legacy_future_cancelled_and_unused_plans(self):
        offer = self.offer()
        unused = self.offer(name='Unused plan')
        self.assertEqual(self.client.delete(f'/owner/offers/{unused["id"]}', headers=self.owner).status_code, 200)
        self.assertEqual(self.client.get('/owner/offers', headers=self.customer).status_code, 403)
        with self.Session() as db:
            plan = models.MealPlan(owner_id=self.owner_id, user_id=self.customer_id, plan_type=offer['name'], price=700,
                start_date=date.today()+timedelta(days=2), end_date=date.today()+timedelta(days=8), status='active')
            db.add(plan)
            db.commit()
        self.assertEqual(self.client.delete(f'/owner/offers/{offer["id"]}', headers=self.owner).status_code, 409)
        with self.Session() as db:
            db.query(models.MealPlan).one().status = 'cancelled'
            db.commit()
        self.assertEqual(self.client.delete(f'/owner/offers/{offer["id"]}', headers=self.owner).status_code, 200)

    def test_pause_respects_cutoffs_guests_billing_and_headcount(self):
        self.plan()
        m = self.meal()
        closed = self.meal(meal_type='breakfast', cutoff_time=(datetime.now(timezone.utc)-timedelta(minutes=1)).isoformat())
        guest = self.meal(meal_type='dinner', single_price=75)
        self.assertEqual(self.client.put('/owner/guest-price', headers=self.owner, json={'price':75}).status_code, 200)
        self.client.post('/meals/add-guest', headers=self.customer, json={'meal_id':guest['id'], 'extra_cost':75})
        tomorrow = (date.today()+timedelta(days=1)).isoformat()
        body = {'start_date':tomorrow, 'end_date':tomorrow}
        r = self.client.post('/subscriptions/pause', headers=self.customer, json=body)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()['skipped'], 1)
        statuses = {x['id']:x['status'] for x in self.client.get('/meals/upcoming', headers=self.customer).json()}
        self.assertEqual(statuses[m['id']], 'skipped')
        self.assertEqual(statuses[closed['id']], 'confirmed')
        self.assertEqual(statuses[guest['id']], 'guest_added')
        self.assertEqual(self.client.get('/bills/current', headers=self.customer).json()['final_amount'], 3075)
        count = self.client.get('/dashboard/headcount', headers=self.owner).json()['meals']
        self.assertEqual(next(x for x in count if x['meal_id']==m['id'])['expected_headcount'], 0)
        self.assertEqual(self.client.post('/subscriptions/pause', headers=self.customer, json=body).json()['skipped'], 0)
        self.assertEqual(self.client.post('/subscriptions/pause', headers=self.owner, json=body).status_code, 403)

    def test_reviews_only_eligible_past_meals_and_public_privacy(self):
        with self.Session() as db:
            db.add(models.MealPlan(owner_id=self.owner_id, user_id=self.customer_id, price=3000, meal_price=50,
                start_date=date.today()-timedelta(days=10),end_date=date.today()+timedelta(days=10),status='active'))
            db.commit()
        past = self.meal(days=-1)
        future = self.meal()
        self.assertEqual(self.client.post('/reviews', headers=self.customer, json={'meal_id':future['id'],'rating':5}).status_code, 400)
        self.assertEqual(self.client.post('/reviews', headers=self.customer, json={'meal_id':past['id'],'rating':6}).status_code, 422)
        body = {'meal_id':past['id'],'rating':4,'comment':'Delicious dal'}
        self.assertEqual(self.client.post('/reviews', headers=self.customer, json=body).status_code, 200)
        self.assertEqual(self.client.post('/reviews', headers=self.customer, json={**body,'rating':5}).status_code, 200)
        reviews = self.client.get('/public/reviews').json()
        self.assertEqual(len(reviews), 1)
        self.assertEqual(reviews[0]['rating'], 5)
        self.assertNotIn('phone', reviews[0])
        self.assertNotIn('user_id', reviews[0])
        self.assertEqual(self.client.get('/reviews/eligible', headers=self.customer).json()[0]['rating'], 5)

    def test_public_menu_only_upcoming_and_bill_full_subscription(self):
        self.plan()
        self.meal(days=-1)
        upcoming = self.meal(days=1)
        self.meal(days=9,meal_type='breakfast')
        self.assertEqual([m['id'] for m in self.client.get('/public/menu').json()], [upcoming['id']])
        # A subscription crossing month boundaries must include every eligible skip.
        with self.Session() as db:
            plan = db.query(models.MealPlan).first()
            past_date = date.today().replace(day=1)-timedelta(days=1)
            plan.start_date = past_date
            meal = models.Meal(owner_id=self.owner_id, date=past_date,meal_type='dinner',menu_description='Dal',is_complimentary=True)
            db.add(meal);db.flush()
            db.add(models.MealOrder(owner_id=self.owner_id, user_id=self.customer_id,meal_id=meal.id,status='skipped',extra_cost=0))
            db.commit()
        self.assertEqual(self.client.get('/bills/current',headers=self.customer).json()['deductions'], 50)

    def test_delivery_permissions_privacy_and_dispatched_meal_lock(self):
        self.plan()
        meal = self.meal(days=0)
        body = {'user_id':self.customer_id,'meal_id':meal['id'],'status':'preparing'}
        self.assertEqual(self.client.put('/owner/deliveries',headers=self.customer,json=body).status_code,403)
        self.assertEqual(self.client.put('/owner/deliveries',headers=self.owner,json=body).status_code,400)
        address = {'address':'Room 201, Sample hostel, Main road 462001','instructions':'Leave at reception'}
        self.assertEqual(self.client.put('/delivery/address',headers=self.customer,json=address).status_code,200)
        self.assertEqual(self.client.put('/owner/deliveries',headers=self.owner,json=body).status_code,200)
        self.assertEqual(self.client.put('/owner/deliveries',headers=self.owner,json={**body,'status':'out_for_delivery'}).status_code,200)
        self.assertEqual(self.client.post('/meals/skip',headers=self.customer,json={'meal_id':meal['id']}).status_code,400)
        pause = {'start_date':date.today().isoformat(),'end_date':date.today().isoformat()}
        self.assertEqual(self.client.post('/subscriptions/pause',headers=self.customer,json=pause).json()['skipped'],0)
        self.assertEqual(self.client.put('/owner/deliveries',headers=self.owner,json=body).status_code,400)
        row = self.client.get('/delivery/status',headers=self.customer).json()[0]
        self.assertEqual(row['status'],'out_for_delivery')
        self.assertNotIn('address',row)
        other,_ = self.account('9876543212','customer')
        self.assertEqual(self.client.get('/delivery/status',headers=other).json(),[])
        self.assertEqual(self.client.get('/delivery/address',headers=other).json()['address'],'')

    def test_direct_payment_receipts_balances_and_duplicate_protection(self):
        from uuid import uuid4
        self.plan()
        bill = self.client.get('/bills/current',headers=self.customer).json()
        body = {'plan_id':bill['plan_id'],'amount':'1000.00','reference':'Cash received','receipt_key':str(uuid4())}
        self.assertEqual(self.client.post('/owner/payments',headers=self.customer,json=body).status_code,403)
        self.assertEqual(self.client.post('/owner/payments',headers=self.owner,json=body).status_code,201)
        self.assertEqual(self.client.post('/owner/payments',headers=self.owner,json=body).status_code,201)
        self.assertEqual(self.client.post('/owner/payments',headers=self.owner,json={**body,'amount':'2000.00'}).status_code,409)
        self.assertEqual(self.client.post('/owner/payments',headers=self.owner,json={**body,'amount':'3000.00','receipt_key':str(uuid4())}).status_code,400)
        bill = self.client.get('/bills/current',headers=self.customer).json()
        self.assertEqual(bill['amount_paid'],1000)
        self.assertEqual(bill['balance_due'],2000)
        self.assertEqual(len(self.client.get('/payments/history',headers=self.customer).json()),1)
        other,_=self.account('9876543212','customer')
        self.assertEqual(self.client.get('/payments/history',headers=other).json(),[])

    def test_legacy_plan_migration_preserves_existing_rows(self):
        from sqlalchemy import text
        from app.migrations import add_skip_deduction_column
        legacy = create_engine('sqlite://')
        with legacy.begin() as conn:
            conn.execute(text('CREATE TABLE meal_plans (id INTEGER PRIMARY KEY, price NUMERIC)'))
            conn.execute(text('INSERT INTO meal_plans (id, price) VALUES (1, 3000)'))
        add_skip_deduction_column(legacy)
        add_skip_deduction_column(legacy)
        with legacy.connect() as conn:
            row = conn.execute(text('SELECT id, price, meal_price FROM meal_plans')).one()
            self.assertEqual(tuple(row), (1, 3000, 50))
        legacy.dispose()

    def test_payment_qr_upload_permissions_validation_and_replacement(self):
        import base64
        from tempfile import TemporaryDirectory
        from pathlib import Path
        from unittest.mock import patch
        png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1kAAAAASUVORK5CYII=')
        details = {'payee_name':'Mess Owner','upi_id':'owner@example','instructions':'Pay cash at the counter, 6–8 pm.'}
        self.assertEqual(self.client.get('/payments/methods').status_code,401)
        self.assertEqual(self.client.put('/owner/payment-methods',headers=self.customer,json=details).status_code,403)
        self.assertEqual(self.client.put('/owner/payment-methods',headers=self.owner,json=details).status_code,200)
        self.assertEqual(self.client.get('/payments/methods',headers=self.customer).json()['instructions'],details['instructions'])
        with TemporaryDirectory() as folder, patch('app.routes.payment_routes.PAYMENT_IMAGE_DIR',Path(folder)):
            files = {'file':('../../fake.png',png,'image/png')}
            self.assertEqual(self.client.post('/owner/payment-qr',headers=self.customer,files=files).status_code,403)
            self.assertEqual(self.client.post('/owner/payment-qr',headers=self.owner,files={'file':('fake.png',b'<svg/>','image/png')}).status_code,422)
            self.assertEqual(self.client.post('/owner/payment-qr',headers=self.owner,files={'file':('big.png',b'x'*(5*1024*1024+1),'image/png')}).status_code,413)
            first = self.client.post('/owner/payment-qr',headers=self.owner,files=files)
            self.assertEqual(first.status_code,200,first.text)
            old = Path(folder)/first.json()['qr_url'].split('/')[-1]
            self.assertEqual(old.read_bytes(),png)
            self.assertNotIn('fake',first.json()['qr_url'])
            second = self.client.post('/owner/payment-qr',headers=self.owner,files=files)
            self.assertEqual(second.status_code,200)
            self.assertNotEqual(second.json()['qr_url'],first.json()['qr_url'])
            self.assertFalse(old.exists())
            methods=self.client.get('/payments/methods',headers=self.customer).json()
            self.assertEqual(methods['qr_url'],second.json()['qr_url'])
            self.assertFalse(methods['cash_available'])
            self.assertEqual(self.client.delete('/owner/payment-qr',headers=self.owner).status_code,200)
            self.assertIsNone(self.client.get('/payments/methods',headers=self.customer).json()['qr_url'])
            self.assertEqual(list(Path(folder).iterdir()),[])

    def test_meal_edit_cutoff_null_and_duplicate(self):
        cutoff = (datetime.now(timezone.utc)+timedelta(days=1)).isoformat()
        m = self.meal(cutoff_time=cutoff)
        r = self.client.put(f'/owner/meals/{m["id"]}', headers=self.owner, json={'date':m['date'], 'meal_type':m['meal_type'], 'is_complimentary':True, 'menu_description':'Paneer, dal, rice', 'cutoff_time':cutoff})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()['menu_description'], 'Paneer, dal, rice')
        self.assertTrue(r.json()['cutoff_time'])
        self.assertEqual(self.client.put(f'/owner/meals/{m["id"]}', headers=self.owner, json={'meal_type':None}).status_code, 422)
        self.meal(meal_type='dinner')
        self.assertEqual(self.client.put(f'/owner/meals/{m["id"]}', headers=self.owner, json={'meal_type':'dinner'}).status_code, 400)
        self.assertEqual(self.client.delete(f'/owner/meals/{m["id"]}', headers=self.owner).status_code, 200)

    def test_customer_actions_history_billing_and_headcount(self):
        self.plan()
        m = self.meal(days=0, single_price=75)
        tomorrow = self.meal()
        url = f'/owner/meals/{m["id"]}'
        body = {'meal_id': m['id']}
        self.assertEqual(self.client.post('/meals/skip', headers=self.customer, json=body).status_code, 200)
        today = self.client.get('/meals/today', headers=self.customer).json()
        self.assertEqual(today[0]['status'], 'skipped')
        bill = self.client.get('/bills/current', headers=self.customer).json()
        self.assertEqual(bill['final_amount'], 3000)
        self.assertEqual(self.client.post('/meals/skip', headers=self.customer, json=body).status_code, 400)
        history = self.client.get('/meals/history', headers=self.customer)
        self.assertEqual(history.json()[0]['meal']['menu_description'], 'Dal, rice and roti')
        self.assertEqual(self.client.post('/meals/undo-skip', headers=self.customer, json=body).status_code, 200)
        self.assertEqual(self.client.put('/owner/guest-price', headers=self.owner, json={'price':75}).status_code, 200)
        self.assertEqual(self.client.post('/meals/add-guest', headers=self.customer, json={**body,'extra_cost':75}).status_code, 200)
        self.assertEqual(self.client.get('/bills/current', headers=self.customer).json()['final_amount'], 3075)
        self.assertEqual(self.client.delete(url, headers=self.owner).status_code, 400)
        self.client.post('/meals/add-guest', headers=self.customer, json={'meal_id':tomorrow['id'],'extra_cost':50})
        headcount = self.client.get('/dashboard/headcount', headers=self.owner).json()['meals'][0]
        self.assertEqual(headcount['expected_headcount'], 2)

    def test_cutoff_and_negative_extras(self):
        self.plan()
        m = self.meal(days=0, cutoff_time=(datetime.now(timezone.utc)-timedelta(minutes=1)).isoformat())
        self.assertEqual(self.client.post('/meals/skip', headers=self.customer, json={'meal_id':m['id']}).status_code, 400)
        self.assertEqual(self.client.post('/meals/add-guest', headers=self.customer, json={'meal_id':m['id'],'extra_cost':-5}).status_code, 422)
        past = self.meal(days=-1)
        self.assertEqual(self.client.post('/meals/skip', headers=self.customer, json={'meal_id':past['id']}).status_code, 403)

    def test_generated_menu_photo_persistence_cache_and_permissions(self):
        import tempfile
        from pathlib import Path
        from unittest.mock import patch, AsyncMock
        from app import menu_images
        with tempfile.TemporaryDirectory() as folder, patch.object(menu_images, "IMAGE_DIR", Path(folder)), patch.dict(os.environ, {"CLOUDFLARE_API_TOKEN": "fake-key-for-mocked-test", "CLOUDFLARE_ACCOUNT_ID": "test-account"}), patch.object(menu_images, "request_image", new_callable=AsyncMock) as provider:
            provider.return_value = b"\x89PNG\r\n\x1a\nmock-image"
            menu = "Masala dosa with coconut chutney"
            response = self.client.post('/owner/menu-images', headers=self.owner, json={'menu_description': menu})
            self.assertEqual(response.status_code, 200, response.text)
            url = response.json()['image_url']
            self.assertTrue((Path(folder) / url.split('/')[-1]).exists())
            again = self.client.post('/owner/menu-images', headers=self.owner, json={'menu_description': menu.upper()})
            self.assertEqual(again.json()['image_url'], url)
            self.assertEqual(provider.await_count, 1)
            self.assertEqual(self.client.post('/owner/menu-images', headers=self.customer, json={'menu_description': menu}).status_code, 403)
            meal = self.meal(menu_description=menu, image_url=url)
            self.assertEqual(meal['image_url'], url)
            self.assertEqual(self.client.get('/meals/upcoming', headers=self.customer).json()[0]['image_url'], url)
            changed = self.client.put(f'/owner/meals/{meal["id"]}', headers=self.owner, json={'menu_description': 'Idli sambar'})
            self.assertIsNone(changed.json()['image_url'])
            stale = self.client.put(f'/owner/meals/{meal["id"]}', headers=self.owner, json={'image_url': url})
            self.assertEqual(stale.status_code, 422)

    def test_image_configuration_error(self):
        from unittest.mock import patch
        with patch.dict(os.environ, {"CLOUDFLARE_API_TOKEN": "", "CLOUDFLARE_ACCOUNT_ID": ""}):
            self.assertFalse(self.client.get('/owner/menu-images/status', headers=self.owner).json()['configured'])
            response = self.client.post('/owner/menu-images', headers=self.owner, json={'menu_description': 'Unique unconfigured menu'})
            self.assertEqual(response.status_code, 503)
            self.assertIn('CLOUDFLARE_API_TOKEN', response.json()['detail'])

    def test_cloudflare_http_request_and_image_response(self):
        import asyncio, base64, json, httpx
        from unittest.mock import patch
        from app.menu_images import request_image
        png = b"\x89PNG\r\n\x1a\ntest"
        def respond(request):
            self.assertEqual(request.headers['Authorization'], 'Bearer test-cloudflare-key')
            self.assertNotIn('test-cloudflare-key', str(request.url))
            self.assertIn('/ai/run/@cf/black-forest-labs/flux-1-schnell', str(request.url))
            body = json.loads(request.content)
            self.assertEqual(body['steps'], 4)
            self.assertIn('Dosa and chutney', body['prompt'])
            return httpx.Response(200, json={'success': True, 'result': {'image': base64.b64encode(png).decode()}})
        client_class = httpx.AsyncClient
        with patch('app.menu_images.httpx.AsyncClient', side_effect=lambda **kw: client_class(transport=httpx.MockTransport(respond), **kw)):
            self.assertEqual(asyncio.run(request_image('Dosa and chutney', 'test-cloudflare-key')), png)

    def test_subscription_validation(self):
        self.plan()
        self.assertEqual(self.client.get('/bills/current', headers=self.customer).status_code, 200)
        self.assertEqual(len(self.client.get('/owner/customers', headers=self.owner).json()), 1)
        self.assertEqual(self.client.get('/owner/customers', headers=self.customer).status_code, 403)

    def test_cloudflare_errors_without_exposing_key(self):
        import asyncio, httpx
        from fastapi import HTTPException
        from unittest.mock import patch
        from app.menu_images import request_image
        client_class = httpx.AsyncClient
        for status, message, expected in [
            (401, 'bad token secret-test-key', 'Cloudflare rejected access'),
            (429, 'quota exhausted secret-test-key', 'quota or rate limit'),
            (500, 'provider secret-test-key', 'could not generate'),
            (403, 'access denied secret-test-key', 'Cloudflare rejected access'),
            (404, 'model not found secret-test-key', 'image model is unavailable'),
        ]:
            with self.subTest(status=status, message=message):
                transport = httpx.MockTransport(lambda request: httpx.Response(status, json={'error':{'message':message}}))
                with patch('app.menu_images.httpx.AsyncClient',side_effect=lambda **kw:client_class(transport=transport,**kw)):
                    with self.assertRaises(HTTPException) as raised:
                        asyncio.run(request_image('Dal and rice','secret-test-key'))
                self.assertIn(expected,raised.exception.detail)
                self.assertNotIn('secret-test-key',raised.exception.detail)

if __name__ == '__main__':
    unittest.main(verbosity=2)

