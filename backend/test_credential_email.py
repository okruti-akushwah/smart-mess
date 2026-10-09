import os
import smtplib
import unittest
from unittest.mock import patch
from app.credential_email import send_credentials

class CredentialEmailTests(unittest.TestCase):
    def test_missing_settings_does_not_send(self):
        with patch.dict(os.environ, {}, clear=True), patch('app.credential_email.smtplib.SMTP') as smtp:
            self.assertEqual(send_credentials('customer@example.com','Customer','9000000002','initial123'),'not_configured')
            smtp.assert_not_called()

    def test_send_and_failure(self):
        settings={'SMTP_HOST':'smtp.gmail.com','SMTP_PORT':'587','SMTP_USER':'owner@example.com','SMTP_PASSWORD':'test-secret','SMTP_FROM':'owner@example.com','CUSTOMER_LOGIN_URL':'https://mess.example/login'}
        with patch.dict(os.environ,settings), patch('app.credential_email.smtplib.SMTP') as smtp:
            self.assertEqual(send_credentials('customer@example.com','Customer','9000000002','initial123'),'sent')
            connection=smtp.return_value.__enter__.return_value
            connection.starttls.assert_called_once()
            mail=connection.send_message.call_args.args[0]
            self.assertEqual(mail['To'],'customer@example.com')
            self.assertIn('9000000002',mail.get_content())
            self.assertIn('initial123',mail.get_content())
            self.assertIn('https://mess.example/login',mail.get_content())
            connection.send_message.side_effect=smtplib.SMTPException('provider error')
            self.assertEqual(send_credentials('customer@example.com','Customer','9000000002','initial123'),'failed')
