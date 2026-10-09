import test_app
from app import models
from decimal import Decimal

class GuestPriceTests(test_app.ApplicationTests):
    def test_fixed_guest_price_count_bill_and_headcount(self):
        self.plan()
        meal = self.meal()
        self.assertEqual(self.client.get('/meals/guest-price',headers=self.customer).json()['price'],50)
        self.assertEqual(self.client.put('/owner/guest-price',headers=self.customer,json={'price':70}).status_code,403)
        self.assertEqual(self.client.put('/owner/guest-price',headers=self.owner,json={'price':-1}).status_code,422)
        response=self.client.post('/meals/add-guest',headers=self.customer,json={'meal_id':meal['id'],'guest_count':2,'extra_cost':1,'expected_unit_price':50})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(self.client.get('/bills/current',headers=self.customer).json()['extras_total'],100)
        count=self.client.get('/dashboard/headcount',headers=self.owner).json()['meals'][0]
        self.assertEqual(count['guests'],2)
        self.assertEqual(count['expected_headcount'],3)
        self.assertEqual(self.client.put('/owner/guest-price',headers=self.owner,json={'price':75}).status_code,200)
        self.assertEqual(self.client.get('/bills/current',headers=self.customer).json()['extras_total'],100)
        next_meal=self.meal(meal_type='dinner')
        body={'meal_id':next_meal['id'],'guest_count':2,'expected_unit_price':50}
        self.assertEqual(self.client.post('/meals/add-guest',headers=self.customer,json=body).status_code,409)
        for count in [0,-1,1.5,101]:
            self.assertEqual(self.client.post('/meals/add-guest',headers=self.customer,json={**body,'guest_count':count}).status_code,422)
        self.assertEqual(self.client.post('/meals/add-guest',headers=self.customer,json={**body,'expected_unit_price':75}).status_code,200)
        self.assertEqual(self.client.get('/bills/current',headers=self.customer).json()['extras_total'],250)
        with self.Session() as db:
            self.assertEqual(db.query(models.MealOrder).filter_by(meal_id=meal['id']).one().extra_cost,Decimal('100'))
