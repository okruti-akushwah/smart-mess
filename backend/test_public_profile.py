from datetime import date
import test_app
from app import models

class PublicProfileTests(test_app.ApplicationTests):
    def test_business_details_saved_public_and_isolated(self):
        payload = {'name': 'Test kitchen', 'owner_name': 'Public owner',
            'business_type': 'Home-style tiffin', 'tagline': 'Fresh daily',
            'food_type': 'Vegetarian', 'service_type': 'Lunch and dinner',
            'operating_days': 'Monday to Saturday', 'opening_time': '07:00',
            'closing_time': '22:00', 'city': 'Jaipur', 'area': 'Mansarovar',
            'fssai_number': '12345678901234', 'business_status': 'Active'}
        saved = self.client.put('/owner/mess-profile', headers=self.owner, json=payload)
        self.assertEqual(saved.status_code, 200, saved.text)
        public = self.client.get('/public/mess/' + saved.json()['join_token']).json()
        for field, value in payload.items():
            self.assertEqual(public[field], value)
        other, _ = self.account('9876543290', 'owner')
        other_profile = self.client.get('/owner/mess-profile', headers=other).json()
        self.assertEqual(other_profile['fssai_number'], '')
        updated = self.client.put('/owner/mess-profile', headers=self.owner, json={'name': 'New name'})
        self.assertEqual(updated.json()['fssai_number'], payload['fssai_number'])
        for bad in ({'fssai_number': '123'}, {'opening_time': '25:00'}, {'business_status': 'Invalid'}):
            self.assertEqual(self.client.put('/owner/mess-profile', headers=self.owner, json=bad).status_code, 422)

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

    def test_bilingual_profile_saved_and_legacy_update_preserves_hindi(self):
        payload = {'name': 'Maa Annapurna Mess', 'name_hi': 'माँ अन्नपूर्णा मेस',
                   'about': 'Fresh homemade meals.', 'about_hi': 'ताज़ा घर का खाना।',
                   'address_hi': 'जयपुर', 'preparation_hi': 'स्वच्छ रसोई में तैयार भोजन।'}
        saved = self.client.put('/owner/mess-profile', headers=self.owner, json=payload)
        self.assertEqual(saved.status_code, 200, saved.text)
        token = saved.json()['join_token']
        public = self.client.get('/public/mess/' + token).json()
        for field, value in payload.items():
            self.assertEqual(public[field], value)
        directory = self.client.get('/public/messes').json()
        self.assertTrue(any(row['name_hi'] == payload['name_hi'] for row in directory))
        updated = self.client.put('/owner/mess-profile', headers=self.owner, json={'name': 'Updated Kitchen'})
        self.assertEqual(updated.json()['name_hi'], payload['name_hi'])
        self.assertEqual(updated.json()['about_hi'], payload['about_hi'])
        cleared = self.client.put('/owner/mess-profile', headers=self.owner, json={'name': 'Updated Kitchen', 'about_hi': ''})
        self.assertEqual(cleared.json()['about_hi'], '')
