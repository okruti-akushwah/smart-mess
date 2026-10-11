import unittest
from datetime import date, timedelta
import test_app
from app import models


class DatePauseTests(unittest.TestCase):
    setUp = test_app.ApplicationTests.setUp
    tearDown = test_app.ApplicationTests.tearDown
    account = test_app.ApplicationTests.account
    meal = test_app.ApplicationTests.meal
    plan = test_app.ApplicationTests.plan

    def test_pause_without_menu_survives_and_skips_future_meals_once(self):
        self.plan()
        day=(date.today()+timedelta(days=2)).isoformat()
        body={'start_date':day,'end_date':day}
        preview=self.client.get('/subscriptions/pause-preview',headers=self.customer,params=body)
        self.assertTrue(preview.json()['can_pause'])
        self.assertEqual(preview.json()['eligible_count'],0)
        with self.Session() as db:
            self.assertEqual(db.query(models.MealDatePause).count(),0)
        for _ in range(2):
            r=self.client.post('/subscriptions/pause',headers=self.customer,json=body)
            self.assertEqual(r.status_code,200,r.text)
            self.assertTrue(r.json()['pause_saved'])
        with self.Session() as db:
            self.assertEqual(db.query(models.MealDatePause).count(),1)
            self.assertEqual(db.query(models.MealPlan).one().skip_count,0)
        lunch=self.meal(days=2)
        dinner=self.meal(days=2,meal_type='dinner')
        upcoming=self.client.get('/meals/upcoming',headers=self.customer).json()
        self.assertEqual({m['status'] for m in upcoming},{'skipped'})
        self.assertEqual(self.client.get('/subscriptions/current',headers=self.customer).json()[0]['skip_count'],2)
        self.assertEqual(self.client.post('/meals/add-guest',headers=self.customer,json={'meal_id':lunch['id']}).status_code,409)
        rows=self.client.get('/dashboard/headcount',headers=self.owner).json()['preparation']
        self.assertTrue(all(m['expected_headcount']==0 for m in rows))
        self.client.put(f"/owner/meals/{dinner['id']}",headers=self.owner,json={'menu_description':'New dinner menu'})
        self.client.post('/subscriptions/pause',headers=self.customer,json=body)
        self.assertEqual(self.client.get('/subscriptions/current',headers=self.customer).json()[0]['skip_count'],2)
        self.assertIn(day,self.client.get('/subscriptions/pause-preview',headers=self.customer,params=body).json()['saved_dates'])

    def test_existing_and_unpublished_dates_share_persistent_pause(self):
        self.plan()
        lunch=self.meal()
        body={'start_date':lunch['date'],'end_date':(date.today()+timedelta(days=3)).isoformat()}
        r=self.client.post('/subscriptions/pause',headers=self.customer,json=body)
        self.assertEqual(r.json()['covered_days'],3)
        self.assertEqual(r.json()['skipped'],1)
        self.meal(days=3)
        self.assertEqual(self.client.get('/subscriptions/current',headers=self.customer).json()[0]['skip_count'],2)
        not_paused=self.meal(days=4)
        statuses={m['id']:m['status'] for m in self.client.get('/meals/upcoming',headers=self.customer).json()}
        self.assertEqual(statuses[not_paused['id']],'confirmed')

    def test_date_pause_stays_in_own_mess_and_requires_subscription(self):
        self.plan()
        day=(date.today()+timedelta(days=1)).isoformat()
        body={'start_date':day,'end_date':day}
        self.client.post('/subscriptions/pause',headers=self.customer,json=body)
        other_owner,_=self.account('9876543288','owner')
        r=self.client.post('/owner/meals',headers=other_owner,json={'date':day,'meal_type':'lunch'})
        self.assertEqual(r.status_code,201,r.text)
        with self.Session() as db:
            self.assertEqual(db.query(models.MealOrder).count(),0)
        other_customer,_=self.account('9876543289','customer')
        self.assertEqual(self.client.post('/subscriptions/pause',headers=other_customer,json=body).status_code,400)

    def test_individual_undo_is_preserved_when_owner_edits_menu(self):
        self.plan()
        meal=self.meal()
        body={'start_date':meal['date'],'end_date':meal['date']}
        self.client.post('/subscriptions/pause',headers=self.customer,json=body)
        self.client.post('/meals/undo-skip',headers=self.customer,json={'meal_id':meal['id']})
        self.client.put(f"/owner/meals/{meal['id']}",headers=self.owner,json={'menu_description':'Edited menu'})
        self.assertEqual(self.client.get('/meals/upcoming',headers=self.customer).json()[0]['status'],'confirmed')
        self.assertEqual(self.client.get('/subscriptions/current',headers=self.customer).json()[0]['skip_count'],0)
