from uuid import uuid4
from test_app import ApplicationTests
from app import models


class ReceiptTests(ApplicationTests):
    def test_receipt_download_is_confirmed_private_and_safely_formatted(self):
        self.plan()
        with self.Session() as db:
            plan = db.query(models.MealPlan).one()
            plan_id = plan.id
            db.get(models.User, self.customer_id).name = 'Customer <script>alert(1)</script>'
            db.commit()
        self.assertEqual(self.client.get('/payments/receipts/1', headers=self.customer).status_code, 404)
        payment = self.client.post('/owner/payments', headers=self.owner, json={
            'plan_id': plan_id, 'amount': 1000, 'reference': 'UPI <test>', 'receipt_key': str(uuid4())})
        self.assertEqual(payment.status_code, 201, payment.text)
        receipt_id = payment.json()['id']
        url = f'/payments/receipts/{receipt_id}'
        downloaded = self.client.get(url, headers=self.customer)
        self.assertEqual(downloaded.status_code, 200, downloaded.text)
        self.assertIn('attachment;', downloaded.headers['content-disposition'])
        self.assertIn('no-store', downloaded.headers['cache-control'])
        self.assertIn('₹1000.00', downloaded.text)
        self.assertIn('Confirmed payment', downloaded.text)
        self.assertIn('UPI &lt;test&gt;', downloaded.text)
        self.assertNotIn('<script>', downloaded.text)
        self.assertIn('IST', downloaded.text)
        other_customer, _ = self.account('9876543212', 'customer')
        self.assertEqual(self.client.get(url, headers=other_customer).status_code, 404)
        other_owner, _ = self.account('9876543213', 'owner')
        self.assertEqual(self.client.get(url, headers=other_owner).status_code, 404)
        self.assertEqual(self.client.get(url, headers=self.owner).status_code, 200)
        self.assertEqual(self.client.get(url).status_code, 401)
