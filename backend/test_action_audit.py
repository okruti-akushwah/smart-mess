import test_app
from datetime import date,timedelta
from app import models
class ActionAuditTests(test_app.ApplicationTests):
    def test_meal_actions_require_customer_subscription(self):
        meal=self.meal()
        for headers in [self.customer,self.owner]:
            for endpoint in ['skip','add-guest','undo-skip']:
                r=self.client.post('/meals/'+endpoint,headers=headers,json={'meal_id':meal['id']})
                self.assertIn(r.status_code,[400,403,404],r.text)
        with self.Session() as db:
            self.assertEqual(db.query(models.MealOrder).count(),0)
        self.plan()
        far=self.meal(days=40)
        for endpoint in ['skip','add-guest']:
            self.assertEqual(self.client.post('/meals/'+endpoint,headers=self.customer,json={'meal_id':far['id']}).status_code,403)

    def test_generated_bill_changes_and_duplicate_issue(self):
        self.plan()
        meal=self.meal()
        plan=self.client.get('/bills/current',headers=self.customer).json()['plan_id']
        first=self.client.post(f'/owner/bills/{plan}',headers=self.owner).json()
        self.assertTrue(self.client.get('/owner/payments',headers=self.owner).json()[0]['bill_generated'])
        self.client.post('/meals/add-guest',headers=self.customer,json={'meal_id':meal['id'],'guest_count':2})
        self.assertFalse(self.client.get('/owner/payments',headers=self.owner).json()[0]['bill_generated'])
        updated=self.client.post(f'/owner/bills/{plan}',headers=self.owner).json()
        self.assertNotEqual(first['id'],updated['id'])
        self.assertEqual(updated['final_amount'],3100)
        self.assertEqual(self.client.post(f'/owner/bills/{plan}',headers=self.owner).json()['id'],updated['id'])

    def test_delivery_serving_time_and_guest_migration(self):
        self.plan()
        meal=self.meal(days=0)
        self.client.put('/owner/mess-profile',headers=self.owner,json={'name':'Test Kitchen','timings':[{'meal_type':'lunch','from_time':'12:00','to_time':'14:00'}]})
        row=self.client.get('/owner/deliveries',headers=self.owner).json()[0]
        self.assertEqual(row['serving_ends_at'],date.today().isoformat()+'T14:00:00+05:30')
        row=self.client.get('/delivery/status',headers=self.customer).json()[0]
        self.assertNotIn('phone',row)
        self.assertIn('serving_ends_at',row)
        from sqlalchemy import create_engine,text,inspect
        from app.migrations import add_guest_count_column
        engine=create_engine('sqlite://')
        with engine.begin() as connection:
            connection.execute(text('CREATE TABLE meal_orders (id INTEGER PRIMARY KEY, status VARCHAR, extra_cost NUMERIC)'))
            connection.execute(text("INSERT INTO meal_orders VALUES (1, 'guest_added', 75)"))
        add_guest_count_column(engine)
        add_guest_count_column(engine)
        with engine.connect() as connection:
            row=connection.execute(text('SELECT guest_count, extra_cost FROM meal_orders')).one()
            self.assertEqual(tuple(row),(1,75))
        engine.dispose()
