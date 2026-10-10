import os
from datetime import datetime, timedelta, date
from unittest.mock import patch
import httpx
from test_app import ApplicationTests
from app import models, signup_otp

class SignupOtpTests(ApplicationTests):
    def setUp(self):
        super().setUp()
        self.config=patch.dict(os.environ,{"SIGNUP_OTP_MODE":"console","APP_ENV":"development"}); self.config.start()
        self.random=patch("app.signup_otp.secrets.randbelow",return_value=123456); self.random.start()
        self.logs=patch("app.signup_otp.logger.warning"); self.logs.start()

    def tearDown(self):
        self.logs.stop();self.random.stop();self.config.stop();super().tearDown()

    def request(self, phone="9999999999", token=None):
        r=self.client.post('/auth/signup/otp',json={"phone":phone,"join_token":token})
        self.assertEqual(r.status_code,200,r.text)
        self.assertNotIn('123456',r.text)
        self.assertNotIn('access_token',r.json())
        return r.json()['challenge_id']

    def verify(self, challenge, code="123456"):
        return self.client.post('/auth/signup/verify-otp',json={"challenge_id":challenge,"code":code})

    def test_login_never_requires_otp(self):
        r=self.client.post('/auth/login',json={"phone":"9876543210","password":"test1234"})
        self.assertIn('access_token',r.json());self.assertNotIn('otp_required',r.json())
        self.assertEqual(self.client.post('/auth/token',data={"username":"9876543210","password":"test1234"}).status_code,200)

    def test_production_demo_signup_keeps_customer_approval(self):
        with patch.dict(os.environ, {"SIGNUP_OTP_MODE": "off", "APP_ENV": "production"}):
            settings = self.client.get('/auth/signup/settings')
            self.assertEqual(settings.json(), {"demo_registration": True, "otp_required": False})
            token = self.client.get('/owner/join-link', headers=self.owner).json()['token']
            body = {"name": "Demo customer", "phone": "9999999999", "password": "test1234"}
            with patch('app.signup_otp.provider_request') as sms:
                response = self.client.post('/join/' + token, json=body)
                self.assertEqual(response.status_code, 201, response.text)
                sms.assert_not_called()
            login = self.client.post('/auth/login', json={"phone": body['phone'], "password": body['password']})
            headers = {"Authorization": "Bearer " + login.json()['access_token']}
            self.assertEqual(self.client.get('/join-status', headers=headers).json()['status'], 'pending')
            self.assertEqual(self.client.get('/customer/activity', headers=headers).status_code, 403)
            owner = {"name": "Demo owner", "mess_name": "Demo Kitchen", "phone": "9999999998", "password": "test1234", "role": "owner"}
            self.assertEqual(self.client.post('/auth/signup', json=owner).status_code, 200)
        self.assertEqual(self.client.get('/auth/signup/settings').json(), {"demo_registration": False, "otp_required": True})

    def test_owner_signup_requires_verified_phone(self):
        with self.Session() as db: db.query(models.User).delete();db.commit()
        body={"name":"Owner","mess_name":"Test Mess","phone":"9999999999","password":"1234","role":"owner"}
        self.assertEqual(self.client.post('/auth/signup',json=body).status_code,403)
        challenge=self.request()
        self.assertEqual(self.client.post('/auth/signup',json={**body,"verification_id":challenge}).status_code,403)
        self.assertEqual(self.verify(challenge).status_code,200)
        self.assertEqual(self.client.post('/auth/signup',json={**body,"verification_id":challenge}).status_code,200)
        with self.Session() as db: self.assertTrue(db.get(models.SignupChallenge,challenge).consumed)
        self.assertEqual(self.verify(challenge).status_code,400)

    def test_phone_can_be_verified_before_owner_details_are_entered(self):
        self.assertEqual(self.client.post('/auth/signup/otp', json={'phone': '99999'}).status_code, 422)
        with self.Session() as db:
            accounts_before = db.query(models.User).count()
        challenge = self.request()
        result = self.verify(challenge)
        self.assertEqual(result.status_code, 200, result.text)
        with self.Session() as db:
            self.assertEqual(db.query(models.User).count(), accounts_before)
            self.assertTrue(db.get(models.SignupChallenge, challenge).verified)
            self.assertFalse(db.get(models.SignupChallenge, challenge).consumed)
        body = {'name': 'Phone-first owner', 'mess_name': 'Phone-first Kitchen',
                'phone': '9999999999', 'password': 'test1234', 'role': 'owner',
                'verification_id': result.json()['verification_id']}
        self.assertEqual(self.client.post('/auth/signup', json={**body, 'phone': '9999999998'}).status_code, 403)
        response = self.client.post('/auth/signup', json=body)
        self.assertEqual(response.status_code, 200, response.text)

    def test_customer_signup_phone_binding_and_approval(self):
        token=self.client.get('/owner/join-link',headers=self.owner).json()['token']; offer=self.offer()
        body={"name":"New Customer","phone":"9999999999","password":"1234","offer_id":offer['id'],"start_date":date.today().isoformat()}
        url='/join/'+token
        self.assertEqual(self.client.post(url,json=body).status_code,403)
        challenge=self.request(token=token); self.assertEqual(self.verify(challenge).status_code,200)
        self.assertEqual(self.client.post(url,json={**body,"phone":"9999999998","verification_id":challenge}).status_code,403)
        self.assertEqual(self.client.post(url,json={**body,"verification_id":challenge}).status_code,201)
        login=self.client.post('/auth/login',json={"phone":body['phone'],"password":body['password']})
        self.assertIn('access_token',login.json())
        headers={"Authorization":"Bearer "+login.json()['access_token']}
        self.assertEqual(self.client.get('/join-status',headers=headers).json()['status'],'pending')

    def test_wrong_expired_codes_and_cooldown(self):
        token=self.client.get('/owner/join-link',headers=self.owner).json()['token']; challenge=self.request(token=token)
        self.assertEqual(self.client.post('/auth/signup/otp',json={"phone":"9999999999","join_token":token}).status_code,429)
        for _ in range(5): self.assertEqual(self.verify(challenge,'000000').status_code,400)
        self.assertEqual(self.verify(challenge).status_code,429)
        with self.Session() as db:
            row=db.get(models.SignupChallenge,challenge);row.attempts=0;row.expires_at=datetime.utcnow()-timedelta(seconds=1);db.commit()
        self.assertEqual(self.verify(challenge).status_code,400)

    def test_twilio_provider_and_production_console_rejected(self):
        with patch.dict(os.environ,{"SIGNUP_OTP_MODE":"twilio","TWILIO_ACCOUNT_SID":"ACtest","TWILIO_AUTH_TOKEN":"test-token","TWILIO_VERIFY_SERVICE_SID":"VAtest"}):
            with patch('app.signup_otp.httpx.post',return_value=httpx.Response(201,json={"status":"pending"})) as send:
                self.assertTrue(signup_otp.provider_request('Verifications','9999999999'))
                self.assertEqual(send.call_args.kwargs['data'],{"To":"+919999999999","Channel":"sms"})
            with patch('app.signup_otp.httpx.post',return_value=httpx.Response(200,json={"status":"approved"})):
                self.assertTrue(signup_otp.provider_request('VerificationCheck','9999999999','123456'))
        with patch.dict(os.environ,{"APP_ENV":"production"}):
            with self.assertRaises(Exception) as error: signup_otp.mode()
            self.assertEqual(error.exception.status_code,503)
