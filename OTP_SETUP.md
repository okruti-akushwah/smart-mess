# Signup-only mobile OTP

OTP is required when creating a new owner account or customer account. Normal login uses the registered phone number and password, without OTP. Existing accounts are preserved. Customer membership approval is still required after signup.

## Test locally (current mode)

`backend/.env` contains `SIGNUP_OTP_MODE=console`. No SMS is sent, and this mode does not verify possession of a real phone. The page clearly labels it as local testing.

1. Start the backend on port 8000 and frontend on 5173 as usual.
2. Open `/owner/register` or a customer's mess join link and enter a 10-digit phone number. Verification appears directly below the phone field; other details are not required to request or verify a code.
3. The form requests an OTP automatically after the tenth digit. Read the six-digit code from the backend terminal line labelled **LOCAL TEST ONLY - signup OTP**. Use **Send signup OTP** to retry if the request failed.
4. Enter the code and click **Verify number** in the same form. Finish the remaining details and click **Request to join**. Changing the phone number clears verification. The account and join request are created only after successful verification.
5. Ask the owner to approve the request. Customers can then log in with phone and password; no login OTP is requested.
6. Owners verify their phone before their name, mess name and password fields appear, then click **Register your mess**. Additional owners can register their own independent messes. Typing a valid-looking number alone does not prove ownership; the code must still be entered and verified.

Codes expire after five minutes, allow five incorrect attempts, and have a 60-second resend cooldown. Sending is limited to five requests per mobile number per hour. New requests invalidate older challenges. Verification is bound to the phone and signup destination, and cannot be reused to create a different account.

## Real mobile SMS

Create a Twilio Verify service and add these values to **backend/.env**, then restart the backend:

```dotenv
SIGNUP_OTP_MODE=twilio
APP_ENV=production
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_VERIFY_SERVICE_SID=your_verify_service_sid
```

The backend sends SMS to +91 followed by the entered 10-digit mobile number. Keep credentials in backend/.env only. Check provider destination permissions, trial recipient restrictions and current charges before using real SMS.

Official setup: https://www.twilio.com/docs/verify/api

Console mode is rejected in production. `SIGNUP_OTP_MODE=off` is only a compatibility setting for isolated test fixtures and disables signup verification. It is not needed for ordinary login.

## API flow

- `POST /auth/signup/otp`: request a signup code, scoped to owner setup or a valid customer join link.
- `POST /auth/signup/verify-otp`: verify the code and return a short-lived opaque verification ID; this is not a login token.
- `POST /auth/signup` or `POST /join/{token}`: consume that verification ID in the same transaction that creates the account.
- `POST /auth/login`: normal password login, no OTP.

New signup OTP tables are created automatically on backend startup. Existing account data is not reset. Old login OTP is no longer used.

## Checks

```powershell
backend\.runtime\Scripts\python.exe backend/run_tests.py
```

From frontend:

```powershell
npm run lint
npm run build
npm run test:language
```
