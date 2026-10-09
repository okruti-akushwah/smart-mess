import test_app
from datetime import date, timedelta
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
        self.assertEqual(self.client.get('/bills/current',headers=customer).json()['base_amount'],1500)
        self.assertEqual(self.client.get('/owner/join-requests',headers=self.owner).json(),[])
        with self.Session() as db:
            user=db.query(models.User).filter_by(phone=body['phone']).one()
            self.assertNotEqual(user.password_hash,body['password'])
            self.assertEqual(db.query(models.MealPlan).filter_by(user_id=user.id).count(),1)
