from datetime import date, timedelta
import test_app
from app import models


class MemberExtensionsTests(test_app.ApplicationTests):
    def test_member_directory_shows_earned_days_not_shifted_dates(self):
        today = date.today()
        with self.Session() as db:
            db.add_all([
                models.MealPlan(owner_id=self.owner_id, user_id=self.customer_id,
                    plan_type='Extended plan', price=1000, status='active', skip_count=5,
                    start_date=today, end_date=today+timedelta(days=11)),
                models.MealPlan(owner_id=self.owner_id, user_id=self.customer_id,
                    plan_type='Shifted future plan', price=1000, status='active', skip_count=0,
                    original_start_date=today+timedelta(days=7), original_end_date=today+timedelta(days=13),
                    start_date=today+timedelta(days=12), end_date=today+timedelta(days=18)),
            ])
            db.commit()
        response = self.client.get('/owner/customers', headers=self.owner)
        self.assertEqual(response.status_code, 200, response.text)
        subscriptions = response.json()[0]['subscriptions']
        self.assertEqual({plan['name']: plan['extension_days'] for plan in subscriptions},
                         {'Extended plan': 5, 'Shifted future plan': 0})
