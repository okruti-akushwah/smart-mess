import json
import unittest
from unittest.mock import patch
from datetime import datetime, timedelta
import httpx
import test_app
from app import models
from app.routes import kitchen_advisor as advisor


class AdvisorLogicTests(unittest.TestCase):
    def test_provider_rejects_invented_evidence_and_masks_contact_details(self):
        self.assertNotIn('9876543210', advisor.redact('Call 9876543210 or joe@example.com'))
        self.assertNotIn('joe@example.com', advisor.redact('Call 9876543210 or joe@example.com'))
        payload = {'summary': 'Rice needs attention.', 'positives': [], 'actions': [],
                   'issues': [{'title': 'Rice', 'detail': 'Check rice.', 'review_ids': ['foreign-id']}]}
        response = httpx.Response(200, json={'candidates': [{'content': {'parts': [{'text': json.dumps(payload)}]}}]},
                                  request=httpx.Request('POST', 'https://example.com'))
        with patch.dict('os.environ', {'GEMINI_API_KEY': 'test-key'}), patch.object(advisor.httpx, 'post', return_value=response):
            with self.assertRaises(advisor.HTTPException) as error:
                advisor.generate_advice([{'id': 'r1', 'rating': 2, 'comment': 'Rice hard'}], 'en')
        self.assertEqual(error.exception.status_code, 502)

    def test_provider_quota_is_reported_without_exposing_credentials(self):
        response = httpx.Response(429, request=httpx.Request('POST', 'https://example.com'))
        with patch.dict('os.environ', {'GEMINI_API_KEY': 'private-test-key'}), patch.object(advisor.httpx, 'post', return_value=response):
            with self.assertRaises(advisor.HTTPException) as error:
                advisor.generate_advice([], 'en')
        self.assertEqual(error.exception.status_code, 503)
        self.assertNotIn('private-test-key', error.exception.detail)


class AdvisorRoutesTests(test_app.ApplicationTests):
    def setUp(self):
        super().setUp()
        advisor._cache.clear()
        advisor._last_request.clear()

    def test_advisor_scope_permissions_cache_and_no_database_writes(self):
        meal = self.meal()
        other, other_id = self.account('9876543299', 'owner')
        with self.Session() as db:
            db.add_all([
                models.Feedback(owner_id=self.owner_id, user_id=self.customer_id, meal_id=meal['id'], rating=2, comment='Rice was hard. Call 9876543210'),
                models.Feedback(owner_id=other_id, user_id=other_id, meal_id=meal['id'], rating=1, comment='Other kitchen secret'),
            ])
            db.commit()
        url = '/owner/kitchen-advisor'
        self.assertEqual(self.client.get(url+'/reviews').status_code, 401)
        self.assertEqual(self.client.post(url+'/analyze', headers=self.customer, json={}).status_code, 403)
        rows = self.client.get(url+'/reviews', headers=self.owner).json()
        self.assertEqual(rows['review_count'], 1)
        self.assertNotIn('9876543210', json.dumps(rows))
        self.assertNotIn('Other kitchen secret', json.dumps(rows))
        self.assertEqual(self.client.get(url+'/reviews?days=999', headers=self.owner).status_code, 422)
        fake = {'summary': 'Check rice.', 'positives': [], 'issues': [], 'actions': []}
        with patch.object(advisor, 'generate_advice', return_value=(fake, 'mock-model')) as generate:
            first = self.client.post(url+'/analyze', headers=self.owner, json={})
            self.assertEqual(first.status_code, 200, first.text)
            second = self.client.post(url+'/analyze', headers=self.owner, json={})
            self.assertTrue(second.json()['cached'])
            self.assertEqual(generate.call_count, 1)
        with self.Session() as db:
            self.assertEqual(db.query(models.Feedback).count(), 2)

    def test_empty_period_and_explicit_sample_mode(self):
        url = '/owner/kitchen-advisor'
        self.assertEqual(self.client.post(url+'/analyze', headers=self.owner, json={}).status_code, 400)
        sample = self.client.get(url+'/reviews?demo=true', headers=self.owner).json()
        self.assertTrue(sample['demo'])
        self.assertEqual(sample['review_count'], 8)
        with self.Session() as db:
            self.assertEqual(db.query(models.Feedback).count(), 0)

    def test_review_date_window(self):
        meal = self.meal()
        with self.Session() as db:
            db.add(models.Feedback(owner_id=self.owner_id, user_id=self.customer_id, meal_id=meal['id'], rating=4,
                comment='Tasty dal', created_at=datetime.utcnow()-timedelta(days=10)))
            db.commit()
        self.assertEqual(self.client.get('/owner/kitchen-advisor/reviews?days=7', headers=self.owner).json()['review_count'], 0)
        self.assertEqual(self.client.get('/owner/kitchen-advisor/reviews?days=30', headers=self.owner).json()['review_count'], 1)
