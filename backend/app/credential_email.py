"""Send registration credentials without storing or logging plaintext passwords."""
import os
import smtplib
import ssl
from email.message import EmailMessage


def email_ready():
    return all(os.getenv(key, '').strip() for key in ('SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'CUSTOMER_LOGIN_URL'))


def send_credentials(address, name, phone, password):
    if not email_ready():
        return 'not_configured'
    message = EmailMessage()
    message['Subject'] = 'Your Smart Mess login credentials'
    message['From'] = os.environ['SMTP_FROM']
    message['To'] = address
    message.set_content(f"Hello {name},\n\nYour mess owner has created your account.\n\nLogin: {os.environ['CUSTOMER_LOGIN_URL']}\nLogin ID (phone): {phone}\nInitial password: {password}\n\nKeep these credentials private. Your owner will assign your meal subscription.\n\nSmart Mess")
    try:
        with smtplib.SMTP(os.environ['SMTP_HOST'], int(os.getenv('SMTP_PORT', '587')), timeout=12) as smtp:
            smtp.ehlo()
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
            smtp.login(os.environ['SMTP_USER'], os.environ['SMTP_PASSWORD'])
            smtp.send_message(message)
        return 'sent'
    except (OSError, smtplib.SMTPException, ValueError):
        return 'failed'
