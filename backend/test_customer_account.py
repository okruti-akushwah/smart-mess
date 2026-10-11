from datetime import date
import test_app
from app import models


class CustomerAccountTests(test_app.ApplicationTests):
    def test_account_requires_customer_and_uses_their_mess(self):
        self.assertEqual(self.client.get('/customer/account').status_code, 401)
        self.assertEqual(self.client.get('/customer/account', headers=self.owner).status_code, 403)
        self.client.put('/owner/mess-profile', headers=self.owner,
                        json={'name': 'My Kitchen', 'address': 'Test Street'})
        other_owner, _ = self.account('9876543290', 'owner')
        self.client.put('/owner/mess-profile', headers=other_owner,
                        json={'name': 'Another Kitchen'})
        self.plan()
        with self.Session() as db:
            plan = db.query(models.MealPlan).filter_by(user_id=self.customer_id).first()
            db.add(models.MealDatePause(owner_id=self.owner_id,
                user_id=self.customer_id, plan_id=plan.id, date=date.today(), active=True))
            db.commit()
        response = self.client.get('/customer/account', headers=self.customer)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['mess_name'], 'My Kitchen')
        self.assertEqual(response.json()['customer_name'], 'Customer')
        self.assertEqual(response.json()['paused_dates'], [date.today().isoformat()])
        self.assertNotIn('join_token', response.json())

    def test_account_has_name_before_owner_saves_profile(self):
        response = self.client.get('/customer/account', headers=self.customer)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['mess_name'], 'Owner’s mess')
        self.assertEqual(response.json()['paused_dates'], [])
