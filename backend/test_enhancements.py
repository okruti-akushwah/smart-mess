import test_app
from datetime import date
from app import models

class EnhancementTests(test_app.ApplicationTests):
    def test_public_link_uses_its_owner_and_plan(self):
        other,other_id=self.account('9876543266','owner')
        response=self.client.put('/owner/mess-profile',headers=other,json={'name':'Real Mess','address':'Real address'})
        self.assertEqual(response.status_code,200,response.text)
        token=self.client.get('/owner/join-link',headers=other).json()['token']
        page=self.client.get('/public/mess/'+token).json()
        self.assertEqual(page['name'],'Real Mess')
        offer=self.client.post('/owner/offers',headers=other,json={'name':'Weekly regular','category':'regular','duration_days':7,'price':700,'meal_price':35,'description':'Meals from Real Mess'}).json()
        body={'name':'New Customer','phone':'9876543277','password':'chosen123','offer_id':offer['id'],'start_date':date.today().isoformat()}
        result=self.client.post('/join/'+page['join_token'],json=body)
        self.assertEqual(result.status_code,201,result.text)
        self.assertEqual(len(self.client.get('/owner/join-requests',headers=other).json()),1)
        self.assertEqual(self.client.get('/owner/join-requests',headers=self.owner).json(),[])
        request=self.client.get('/owner/join-requests',headers=other).json()[0]
        self.assertEqual(request['plan']['price'],700)
        self.assertEqual(self.client.patch(f"/owner/join-requests/{request['id']}",headers=other,json={'status':'approved','price':1}).status_code,200)
        with self.Session() as db:
            selected=db.query(models.MealPlan).filter_by(plan_type='Weekly regular').one()
            self.assertEqual(float(selected.price),700)

    def test_timings_saved_validated_and_preserved(self):
        body={'name':'Kitchen','timings':[{'meal_type':'lunch','from_time':'12:00','to_time':'14:30'},{'meal_type':'dinner','from_time':'19:00','to_time':'21:00'}]}
        response=self.client.put('/owner/mess-profile',headers=self.owner,json=body)
        self.assertEqual(response.status_code,200,response.text)
        output=self.client.get('/owner/mess-profile',headers=self.owner).json()
        self.assertTrue(output['profile_saved'])
        self.assertEqual(output['timings'],body['timings'])
        self.assertIn('Lunch: 12:00',self.client.get('/public/mess').json()['hours'])
        self.assertEqual(self.client.put('/owner/mess-profile',headers=self.owner,json={'name':'Edited','hours':output['hours']}).status_code,200)
        self.assertEqual(self.client.get('/owner/mess-profile',headers=self.owner).json()['timings'],body['timings'])
        invalid={'timings':[{'meal_type':'lunch','from_time':'14:00','to_time':'12:00'}]}
        self.assertEqual(self.client.put('/owner/mess-profile',headers=self.owner,json=invalid).status_code,422)
        self.assertEqual(self.client.put('/owner/mess-profile',headers=self.owner,json={'timings':[body['timings'][0]]*2}).status_code,422)

    def test_menu_choices_learn_and_persist_without_duplicates(self):
        self.assertIn('Daal',self.client.get('/owner/menu-items',headers=self.owner).json())
        self.assertEqual(self.client.post('/owner/menu-items',headers=self.customer,json={'name':'Aloo'}).status_code,403)
        for name in ('Aloo Gobi','aloo gobi'):
            self.assertEqual(self.client.post('/owner/menu-items',headers=self.owner,json={'name':name}).status_code,201)
        self.assertEqual(len([n for n in self.client.get('/owner/menu-items',headers=self.owner).json() if n.lower()=='aloo gobi']),1)
        meal=self.meal(menu_description='Daal, Roti, Chole, Lemon rice')
        choices=self.client.get('/owner/menu-items',headers=self.owner).json()
        self.assertIn('Chole',choices)
        self.assertIn('Lemon rice',choices)
        self.assertEqual(self.client.put(f"/owner/meals/{meal['id']}",headers=self.owner,json={'menu_description':'Daal, Bhindi'}).status_code,200)
        self.assertIn('Bhindi',self.client.get('/owner/menu-items',headers=self.owner).json())
        other,_=self.account('9876543288','owner')
        self.assertNotIn('Bhindi',self.client.get('/owner/menu-items',headers=other).json())
        self.assertEqual(self.client.post('/owner/menu-items',headers=self.owner,json={'name':'  '}).status_code,422)
