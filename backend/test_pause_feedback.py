import test_app
from datetime import date,timedelta

class PauseFeedbackTests(test_app.ApplicationTests):
    def test_preview_is_read_only_and_pause_updates_bill_once(self):
        self.plan()
        meal=self.meal()
        tomorrow=(date.today()+timedelta(days=1)).isoformat()
        body={'start_date':tomorrow,'end_date':tomorrow}
        preview=self.client.get('/subscriptions/pause-preview',headers=self.customer,params=body)
        self.assertEqual(preview.status_code,200,preview.text)
        self.assertEqual(preview.json()['eligible_count'],1)
        self.assertEqual(preview.json()['meals'][0]['meal_id'],meal['id'])
        self.assertEqual(self.client.get('/bills/current',headers=self.customer).json()['final_amount'],3000)
        paused=self.client.post('/subscriptions/pause',headers=self.customer,json=body)
        self.assertEqual(paused.status_code,200,paused.text)
        self.assertEqual(paused.json()['skipped'],1)
        self.assertEqual(paused.json()['deductions'],0)
        self.assertEqual(self.client.get('/bills/current',headers=self.customer).json()['final_amount'],3000)
        again=self.client.post('/subscriptions/pause',headers=self.customer,json=body).json()
        self.assertEqual(again['skipped'],0)
        self.assertEqual(again['unchanged'][0]['reason'],'Already skipped')
        self.assertEqual(self.client.get('/bills/current',headers=self.customer).json()['final_amount'],3000)

    def test_no_menus_and_outside_plan_explain_no_changes(self):
        self.plan()
        future=(date.today()+timedelta(days=5)).isoformat()
        body={'start_date':future,'end_date':future}
        response=self.client.post('/subscriptions/pause',headers=self.customer,json=body)
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['skipped'],0)
        self.assertTrue(response.json()['pause_saved'])
        self.assertIn('Meals published later',response.json()['message'])
        far=(date.today()+timedelta(days=40)).isoformat()
        response=self.client.get('/subscriptions/pause-preview',headers=self.customer,params={'start_date':far,'end_date':far})
        self.assertEqual(response.status_code,400)
        self.assertIn('No active subscription covers',response.json()['detail'])
        self.assertEqual(self.client.get('/subscriptions/pause-preview',headers=self.owner,params=body).status_code,403)
