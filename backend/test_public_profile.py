from datetime import date
import test_app
from app import models

class PublicProfileTests(test_app.ApplicationTests):
    def test_public_details_menu_and_join_destination(self):
        token=self.client.get('/owner/join-link',headers=self.owner).json()['token']
        initial=self.client.get('/public/mess')
        self.assertEqual(initial.status_code,200,initial.text)
        self.assertEqual(initial.json()['join_token'],token)
        self.assertEqual(initial.json()['address'],'')
        payload={'name':'Test Kitchen','address':'42 Test Street','contact':'hello@example.com','hours':'Lunch 12–2; dinner 7–9','about':'Our test mess welcomes everyone.','preparation':'Choose ingredients.\nCook and serve.'}
        self.assertEqual(self.client.put('/owner/mess-profile',json=payload).status_code,401)
        self.assertEqual(self.client.put('/owner/mess-profile',headers=self.customer,json=payload).status_code,403)
        saved=self.client.put('/owner/mess-profile',headers=self.owner,json=payload)
        self.assertEqual(saved.status_code,200,saved.text)
        for path in ('/public/mess',f'/public/mess/{token}'):
            output=self.client.get(path).json()
            for key,value in payload.items():
                self.assertEqual(output[key],value)
            self.assertNotIn('password_hash',output)
            self.assertNotIn('phone',output)
        self.assertEqual(self.client.get('/public/mess/bad-token').status_code,404)
        meal=self.meal(days=0)
        self.assertEqual(self.client.get('/public/menu').json()[0]['id'],meal['id'])
        # Public browsing doesn't require membership or create a customer account.
        with self.Session() as db:
            self.assertEqual(db.query(models.User).count(),2)
        offer=self.offer()
        self.assertEqual(self.client.post(f'/join/{token}',json={'name':'Public Visitor','phone':'9876543255','password':'chosen123','offer_id':offer['id'],'start_date':date.today().isoformat()}).status_code,201)
        self.assertEqual(len(self.client.get('/owner/join-requests',headers=self.owner).json()),1)
        self.assertEqual(self.client.put('/owner/mess-profile',headers=self.owner,json={**payload,'address':'x'*501}).status_code,422)
