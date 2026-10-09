from test_app import ApplicationTests
from app import models, auth
from app.installation import initialize

class OwnerSetupTests(ApplicationTests):
    def test_existing_installation_allows_second_owner_but_requires_customer_join_link(self):
        status = self.client.get('/auth/registration-status')
        self.assertTrue(status.json()['setup_available'])
        self.assertTrue(status.json()['join_token'])
        for role, code in [('owner', 200), ('customer', 403)]:
            response = self.client.post('/auth/signup', json={'name': 'Other', 'phone': '9999999999', 'password': 'test1234', 'role': role, 'mess_name': 'Other Mess'})
            self.assertEqual(response.status_code, code, response.text)
        self.assertEqual(self.client.get('/owner/meals', headers=self.owner).status_code, 200)

    def test_first_owner_setup_is_atomic_and_saves_mess_name(self):
        with self.Session() as db:
            db.query(models.User).delete()
            db.commit()
        self.assertTrue(self.client.get('/auth/registration-status').json()['setup_available'])
        body = {'name': 'Owner', 'phone': '9999999999', 'password': 'test1234', 'role': 'owner', 'mess_name': ' My Kitchen '}
        self.assertEqual(self.client.post('/auth/signup', json={**body, 'mess_name': ' '}).status_code, 422)
        created = self.client.post('/auth/signup', json=body)
        self.assertEqual(created.status_code, 200, created.text)
        self.assertEqual(self.client.get('/public/mess').json()['name'], 'My Kitchen')
        self.assertTrue(self.client.get('/auth/registration-status').json()['setup_available'])
        self.assertEqual(self.client.post('/auth/signup', json=body).status_code, 409)
        with self.Session() as db:
            self.assertEqual(db.query(models.User).filter_by(role='owner').count(), 1)
            self.assertEqual(db.get(models.MessInstallation, 1).owner_id, created.json()['id'])

    def test_legacy_owners_can_login_and_use_their_own_join_links(self):
        with self.Session() as db:
            demo = models.User(name='Demo', phone='9999999998', role='owner', password_hash=auth.hash_password('test1234'))
            db.add(demo); db.flush()
            demo_id = demo.id
            db.add(models.MessProfile(owner_id=self.owner_id, name='Real Mess'))
            db.add(models.JoinInvite(owner_id=demo_id, token='old-demo-link'))
            db.commit()
            self.assertEqual(initialize(db).owner_id, self.owner_id)
            self.assertEqual(initialize(db).owner_id, self.owner_id)
        credentials = {'phone': '9999999998', 'password': 'test1234'}
        self.assertEqual(self.client.post('/auth/login', json=credentials).status_code, 200)
        self.assertEqual(self.client.post('/auth/token', data={'username': credentials['phone'], 'password': credentials['password']}).status_code, 200)
        old_token = auth.create_access_token({'sub': str(demo_id), 'role': 'owner'})
        self.assertEqual(self.client.get('/owner/meals', headers={'Authorization': 'Bearer '+old_token}).json(), [])
        self.assertEqual(self.client.get('/join/old-demo-link').status_code, 200)
        self.assertEqual(self.client.get('/owner/meals', headers=self.owner).status_code, 200)
