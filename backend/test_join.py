import test_app
from datetime import date, timedelta
from uuid import uuid4
from app import models

class JoinTests(test_app.ApplicationTests):
    def test_join_without_plan_then_choose_subscription_after_approval(self):
        token = self.client.get('/owner/join-link', headers=self.owner).json()['token']
        body = {'name': 'Account first', 'phone': '9876543233', 'password': 'chosen123'}
        response = self.client.post('/join/' + token, json=body)
        self.assertEqual(response.status_code, 201, response.text)
        login = self.client.post('/auth/login', json=body)
        customer = {'Authorization': 'Bearer ' + login.json()['access_token']}
        self.assertEqual(self.client.get('/subscriptions/current', headers=customer).status_code, 403)
        request = self.client.get('/owner/join-requests', headers=self.owner).json()[0]
        self.assertIsNone(request['plan'])
        self.assertEqual(self.client.patch('/owner/join-requests/' + str(request['id']), headers=self.owner, json={'status': 'approved'}).status_code, 200)
        self.assertEqual(self.client.get('/subscriptions/current', headers=customer).json(), [])
        offer = self.offer()
        result = self.client.post('/subscriptions/requests', headers=customer, json={'offer_id': offer['id'], 'start_date': date.today().isoformat()})
        self.assertEqual(result.status_code, 201, result.text)
        plan_request = self.client.get('/owner/requests', headers=self.owner).json()[0]
        self.assertEqual(self.client.patch('/subscriptions/requests/' + str(plan_request['id']), headers=self.owner, json={'status': 'approved'}).status_code, 200)
        self.assertEqual(self.client.get('/subscriptions/current', headers=customer).json(), [])
        issued = self.client.get('/bills/issued', headers=customer).json()
        self.assertEqual(len(issued), 1)
        self.assertEqual(issued[0]['status'], 'pending_payment')
        payment = self.client.post('/owner/payments', headers=self.owner, json={
            'plan_id': issued[0]['plan_id'], 'amount': 700, 'receipt_key': str(uuid4())})
        self.assertEqual(payment.status_code, 201, payment.text)
        self.assertEqual(self.client.get('/subscriptions/current', headers=customer).json()[0]['name'], offer['name'])

    def test_join_approval_and_access(self):
        invitation = self.client.get('/owner/join-link', headers=self.owner)
        self.assertEqual(invitation.status_code,200,invitation.text)
        token=invitation.json()['token']
        self.assertEqual(self.client.get('/owner/join-link',headers=self.owner).json()['token'],token)
        self.assertEqual(self.client.get('/owner/join-link',headers=self.customer).status_code,403)
        self.assertEqual(self.client.get('/join/not-valid').status_code,404)
        self.assertEqual(self.client.get(f'/join/{token}').json()['owner_name'],'Owner')
        offer=self.offer(price=1500,duration_days=30)
        body={'name':'Joining Customer','phone':'9876543233','password':'chosen123','offer_id':offer['id'],'start_date':date.today().isoformat()}
        self.assertEqual(self.client.post(f'/join/{token}',json={**body,'role':'owner'}).status_code,422)
        self.assertEqual(self.client.post(f'/join/{token}',json=body).status_code,201)
        self.assertEqual(self.client.post(f'/join/{token}',json=body).status_code,201)
        self.assertEqual(self.client.post(f'/join/{token}',json={**body,'password':'wrong123'}).status_code,409)
        login=self.client.post('/auth/login',json={'phone':body['phone'],'password':body['password']})
        customer={'Authorization':'Bearer '+login.json()['access_token']}
        self.assertEqual(self.client.get('/join-status',headers=customer).json()['status'],'pending')
        self.assertEqual(self.client.get('/bills/current',headers=customer).status_code,403)
        self.assertEqual(self.client.post('/meals/skip',headers=customer,json={'meal_id':1}).status_code,403)
        requests=self.client.get('/owner/join-requests',headers=self.owner).json()
        self.assertEqual(len(requests),1)
        request_id=requests[0]['id']
        other,_=self.account('9876543244','owner')
        self.assertEqual(self.client.get('/owner/join-requests',headers=other).json(),[])
        endpoint=f'/owner/join-requests/{request_id}'
        self.assertEqual(self.client.patch(endpoint,headers=other,json={'status':'rejected'}).status_code,404)
        self.assertEqual(requests[0]['plan']['name'],offer['name'])
        self.assertEqual(requests[0]['plan']['price'],1500)
        self.assertEqual(self.client.patch(endpoint,headers=self.owner,json={'status':'rejected'}).status_code,200)
        self.assertEqual(self.client.get('/join-status',headers=customer).json()['status'],'rejected')
        self.assertEqual(self.client.post(f'/join/{token}',json=body).status_code,201)
        decision={'status':'approved'}
        self.assertEqual(self.client.patch(endpoint,headers=self.owner,json=decision).status_code,200)
        self.assertEqual(self.client.patch(endpoint,headers=self.owner,json=decision).status_code,409)
        self.assertEqual(self.client.get('/join-status',headers=customer).json()['status'],'approved')
        self.assertEqual(self.client.get('/subscriptions/current',headers=customer).json(),[])
        self.assertEqual(self.client.get('/bills/current',headers=customer).status_code,404)
        issued = self.client.get('/bills/issued',headers=customer).json()
        self.assertEqual(len(issued), 1)
        self.assertEqual(issued[0]['base_amount'], 1500)
        self.assertEqual(issued[0]['status'], 'pending_payment')
        payment = self.client.post('/owner/payments', headers=self.owner, json={
            'plan_id': issued[0]['plan_id'], 'amount': 1500, 'receipt_key': str(uuid4())})
        self.assertEqual(payment.status_code, 201, payment.text)
        self.assertEqual(self.client.get('/subscriptions/current',headers=customer).json()[0]['name'], offer['name'])
        self.assertEqual(self.client.get('/owner/join-requests',headers=self.owner).json(),[])
        with self.Session() as db:
            user=db.query(models.User).filter_by(phone=body['phone']).one()
            self.assertNotEqual(user.password_hash,body['password'])
            self.assertEqual(db.query(models.MealPlan).filter_by(user_id=user.id).count(),1)

    def test_member_account_can_request_and_select_multiple_messes(self):
        second_owner, second_owner_id = self.account('9876543290', 'owner')
        with self.Session() as db:
            db.add(models.MessProfile(owner_id=self.owner_id, name='First Kitchen'))
            db.add(models.MessProfile(owner_id=second_owner_id, name='Second Kitchen'))
            first_invite = models.JoinInvite(owner_id=self.owner_id, token='first-member-test-token')
            second_invite = models.JoinInvite(owner_id=second_owner_id, token='second-member-test-token')
            db.add_all([first_invite, second_invite,
                models.JoinRequest(owner_id=self.owner_id, user_id=self.customer_id, status='approved')])
            db.commit()

        member_body = {'name':'Customer','phone':'9876543211','password':'test1234'}
        joined = self.client.post('/join/second-member-test-token', json=member_body)
        self.assertEqual(joined.status_code, 201, joined.text)
        login = self.client.post('/auth/login', json={'phone':member_body['phone'],'password':member_body['password']})
        headers = {'Authorization':'Bearer '+login.json()['access_token']}
        memberships = self.client.get('/customer/messes', headers=headers).json()
        self.assertEqual(len(memberships), 2)
        self.assertEqual({item['mess_name'] for item in memberships}, {'First Kitchen','Second Kitchen'})
        self.assertEqual(self.client.get('/customer/account', headers=headers).status_code, 409)

        first_headers = {**headers, 'X-Mess-Token':'first-member-test-token'}
        second_headers = {**headers, 'X-Mess-Token':'second-member-test-token'}
        self.assertEqual(self.client.get('/customer/account', headers=first_headers).json()['mess_name'], 'First Kitchen')
        self.assertEqual(self.client.get('/join-status', headers=second_headers).json()['status'], 'pending')
        request_id = self.client.get('/owner/join-requests', headers=second_owner).json()[0]['id']
        self.assertEqual(self.client.patch(f'/owner/join-requests/{request_id}', headers=second_owner,
            json={'status':'approved'}).status_code, 200)
        self.assertEqual(self.client.get('/customer/account', headers=second_headers).json()['mess_name'], 'Second Kitchen')
        self.assertEqual(self.client.get('/owner/customers', headers=self.owner).json()[0]['id'], self.customer_id)
        self.assertEqual(self.client.get('/owner/customers', headers=second_owner).json()[0]['id'], self.customer_id)
