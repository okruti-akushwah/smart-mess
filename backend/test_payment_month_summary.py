from datetime import datetime, date, timedelta, timezone
from uuid import uuid4
from unittest.mock import patch
import unittest
import test_app
from app import models
from app.routes.payment_routes import payment_month_bounds


class MonthBoundsTests(unittest.TestCase):
    def test_india_month_starts_before_utc_and_december_rolls_over(self):
        start, end, month = payment_month_bounds(datetime(2026, 12, 31, 20, tzinfo=timezone.utc))
        self.assertEqual(month, '2027-01')
        self.assertEqual(start, datetime(2026, 12, 31, 18, 30))
        self.assertEqual(end, datetime(2027, 1, 31, 18, 30))
        _, end, _ = payment_month_bounds(datetime(2026, 12, 10, tzinfo=timezone.utc))
        self.assertEqual(end, datetime(2026, 12, 31, 18, 30))


class MonthlyPaymentTests(test_app.ApplicationTests):
    def test_month_receipts_boundaries_owner_isolation_and_permissions(self):
        other_headers, other_id = self.account('9876543298', 'owner')
        start, end, month = payment_month_bounds()
        with self.Session() as db:
            for owner_id in (self.owner_id, other_id):
                plan = models.MealPlan(owner_id=owner_id, user_id=self.customer_id, plan_type='monthly',
                    price=1000, start_date=date.today(), end_date=date.today()+timedelta(days=30), status='active')
                db.add(plan)
                db.flush()
                if owner_id == self.owner_id:
                    payments = [(100, start), (200, end-timedelta(microseconds=1)),
                                (400, start-timedelta(microseconds=1)), (800, end)]
                else:
                    payments = [(9000, start)]
                for amount, created_at in payments:
                    db.add(models.PaymentRecord(owner_id=owner_id, plan_id=plan.id, amount=amount,
                        created_at=created_at, receipt_key=str(uuid4())))
            db.commit()
        url = '/owner/payments/summary'
        self.assertEqual(self.client.get(url).status_code, 401)
        self.assertEqual(self.client.get(url, headers=self.customer).status_code, 403)
        with patch('app.routes.payment_routes.payment_month_bounds', return_value=(start, end, month)):
            response = self.client.get(url, headers=self.owner)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {'total_received': 1500, 'payment_count': 4,
            'month_received': 300, 'month_payment_count': 2, 'month': month})

    def test_no_receipts_returns_zero(self):
        response = self.client.get('/owner/payments/summary', headers=self.owner)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['month_received'], 0)
        self.assertEqual(response.json()['month_payment_count'], 0)
