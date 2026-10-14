# Local development and testing

The updated React website runs at http://127.0.0.1:5173. The isolated preview API runs at http://127.0.0.1:8001/docs and uses preview.db, separate from your configured PostgreSQL database.

Demo owner: 9000000001 / Demo1234
Demo customer: 9000000002 / Demo1234

## Start the preview
Open two PowerShell terminals in C:\Users\akush\mess-manager.

Backend:
```powershell
$env:DATABASE_URL = 'sqlite:///./preview.db'
$env:SECRET_KEY = 'local-preview-session-secret'
$env:APP_ENV = 'development'
# Inspect and back up an existing preview before its first adoption.
backend/.runtime/Scripts/python.exe backend/migrate_database.py status
backend/.runtime/Scripts/python.exe backend/migrate_database.py upgrade --allow-legacy-upgrade
backend/.runtime/Scripts/python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8001
```

Frontend:
```powershell
cd frontend
$env:API_PROXY_TARGET = 'http://127.0.0.1:8001'
npm run dev -- --host 127.0.0.1
```

To populate the isolated preview once, run `backend/.runtime/Scripts/python.exe backend/seed_preview.py` while its API is running.

## Manual checks
1. Log in as owner. Manage Meals → Edit → change the menu → Update Meal. Refresh and confirm the new menu persists.
2. Create a meal for a new date, edit its cutoff, and delete it before any customer action exists.
3. Create a customer account. Log in as owner and assign a subscription from the dashboard.
4. Log in as the demo customer. Skip a meal: the status changes and the live bill drops by ₹50. Undo skip restores the amount.
5. Add a guest for ₹50: the status and bill update. Meal History shows the menu and action.
6. Add a guest for tomorrow: the owner's tomorrow headcount increases by one.
7. Verify past cutoff actions are blocked, duplicate meals are rejected, and customer accounts cannot access owner pages.
8. Check navigation and forms at a mobile width.

## Automated checks
```powershell
backend/.runtime/Scripts/python.exe -m unittest discover -s backend -p test_app.py
cd frontend
npm run lint
npm run build
```
Backend tests use isolated in-memory databases by default. Use
`backend/.runtime/Scripts/python.exe backend/run_tests.py` for the complete isolated
suite. PostgreSQL fixtures require an explicitly selected, dedicated test database;
see LIVE_DEPLOYMENT.md. API import never migrates a database. Run the explicit
migration command before starting a fresh or newly upgraded backend.

## Your configured backend
For your real configured database, omit the preview environment variables and start the app from backend with `./.runtime/Scripts/python.exe -m uvicorn app.main:app --reload`. The app reads backend/.env. The frontend defaults to /api, which Vite proxies to port 8000. Set API_PROXY_TARGET=http://127.0.0.1:8001 when using the isolated preview backend. A missing DATABASE_URL falls back to a local SQLite database. Set a persistent SECRET_KEY before using multiple workers or restarting with persistent logins.

The app supports multiple independent messes. Owners register at `/owner/register` and sign in at `/owner/login`. Each owner receives a unique public page and customer join link with a QR code. Customers choose a mess from the homepage or use that mess's link, select one of its published plans, and wait for that owner to approve them. A phone number identifies one account; a customer account belongs to one mess.

Menus, plans, customers, billing, payments, deliveries, reviews and settings are scoped to the owning mess in backend database sessions. Public catalogues accept a `mess_token`; authenticated catalogues use the account's stored membership. Before restarting an updated backend, inspect and apply the explicit migrations as described in LIVE_DEPLOYMENT.md. Ownership backfills preserve account IDs, passwords, join links and historical records. No data reset or reseeding is needed.

Food photographs illustrate menus. Customers pay the owner directly. Owner-entered receipts track received payments and outstanding balances. The app does not collect money through a payment gateway, automatically finalize bills, offer courier GPS tracking or implement an AI forecast.

## Plans, live menus, reviews and delivery

Owners can open Payments to upload their own PNG/JPEG payment QR (up to 5 MB), set the recipient name and optional UPI ID, and give cash collection instructions. Customers find Scan & pay and Pay cash in person in Bills. Scanning the QR or handing over cash does not automatically mark the bill paid: the owner records received payments, which creates receipts and updates the balance. QR uploads can be replaced or removed without affecting receipts. Keep backend/payment_images when moving the app.

The homepage and /explore load published menus, plan offers and real subscriber reviews from the backend. No pricing is invented: owners publish their own trial (1 day), weekly (7 days), monthly or custom-duration plans. Regular, mini, protein and special are descriptive categories; each approved subscription covers all scheduled meal types within its dates.

Owners publish offers from their dashboard. Customers open Plans & pause, choose a plan and start date, and submit a request. Owner approval creates a bill; the subscription activates only after the owner confirms full payment. Pending requests can be cancelled. Overlapping subscriptions and duplicate pending requests are blocked.

Plans & pause can skip already-published meals across a date range. Closed, dispatched, guest-booked, already-skipped and out-of-plan meals remain unchanged. The subscription end date is unchanged and future menus published after the pause are not automatically skipped. Individual skips can be undone before cutoff.

Reviews are available for non-skipped past meals covered by a subscription, within 60 days. First names, ratings and comments appear publicly. Repeat submissions update the existing review.

Customers save delivery addresses under Delivery. Owners see today's subscribed, non-skipped meals and mark preparing, out for delivery or delivered. Customers refresh their status. Confirm delivery availability directly with the owner; this app does not book couriers. Dispatched meals cannot be skipped.

Owners use Payments to record money they actually received. Receipt keys prevent duplicate recording on retries. Customers see receipts in Bills and paid/balance/credit amounts on their dashboard. If later skips create credit, settle it directly with the owner.

The explicit migration command adds new tables and legacy image_url and meal_price fields without replacing existing rows. API startup only checks the schema. Legacy skip deductions default to ₹50; owners choose their own deduction for new subscriptions. Install backend/requirements.txt to include the PostgreSQL drivers if using your configured database.

Feature checks: publish a weekly offer → request it as a customer → approve as owner → verify the subscription and bill. Pause tomorrow's published meals and check the headcount. Save a delivery address → dispatch today's meal → verify the customer's status and blocked skips. Record a partial direct payment → verify the receipt and reduced balance. Rate an eligible past meal → verify its public review. Automated tests also cover authorization, privacy, cutoff handling and duplicate receipts.

## Automatic AI menu photos
In Manage Meals, type a menu and pause for two seconds. The backend generates a photo, the form previews it, and Create/Update Meal saves its URL. Identical menus reuse cached photos. Changing a menu clears the previous image. Existing meals keep their illustrative category photos until a generated photo is saved.

Set GEMINI_API_KEY in backend/.env and restart the backend to activate generation. MENU_IMAGE_MODEL defaults to gemini-3.1-flash-image. The key is never sent to the browser. Live generation uses your Gemini API billing and may take a minute. Without a key, the UI displays a setup message and meals can still be saved. Keep backend/generated_menu_images when moving the app or database.

Tests mock the image provider; live generation remains unverified until a key is configured. API reference: https://ai.google.dev/gemini-api/docs/image-generation


## Basic owner/customer workflow
1. Owner dashboard: Register a customer with name, 10-digit phone login ID and initial password. Share these credentials, then assign a subscription with its dates, total price and skip deduction.
2. Manage Meals: publish today's lunch/dinner and a future cutoff if needed.
3. Customer dashboard: view today's menu, skip or add a guest. Bills shows the live total including these changes.
4. Owner Payments: upload your QR, then Generate bill for the customer. Repeated generation with unchanged amounts reuses the same bill; changed amounts create a new dated snapshot.
5. Customer receives an in-app notification (refreshes every 15 seconds while logged in). Open Bills, view the generated bill, scan the owner's QR externally, then submit the paid screenshot and amount. For cash, hand it to the owner and submit a cash payment.
6. Owner Payments: view the screenshot, then Confirm received or Reject. Approval creates one receipt and updates the balance. Rejected submissions can be sent again. Notifications are in-app only.

Payment screenshots are private authenticated files stored in backend/payment_proofs; preserve that folder with the database. Apply the explicit migrations before restarting an existing backend to load new workflow tables.

Workflow integration test (isolated SQLite):
```powershell
$env:PYTHONPATH='backend'
backend/.runtime/Scripts/python.exe -m unittest test_workflow.WorkflowTests.test_complete_owner_customer_payment_workflow
```

## Send customer login credentials by email
Registration accepts an optional customer email. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM and CUSTOMER_LOGIN_URL in backend/.env, using backend/env.example as the reference. Gmail uses smtp.gmail.com, port 587 with STARTTLS, and an app password where supported (https://support.google.com/mail/answer/7104828). Keep the sender password in the backend only. CUSTOMER_LOGIN_URL must be reachable from the customer's device.

Restart the API after configuring settings. The registration response distinguishes sent, failed, not_configured and not_requested. A failed email does not undo the account creation; share the entered credentials manually instead of registering a duplicate account. Passwords are hashed in the database and are not stored as plaintext for email retries. SMTP acceptance does not guarantee inbox delivery. Email tests mock SMTP; live sending requires your sender configuration.

## Join QR and owner approval
Open the owner dashboard → Join my mess. Copy the reusable join link or download its QR image. Customers open it, enter their name/phone and choose their own password. They can log in immediately to see Waiting for owner approval. The owner reviews Customer join requests and selects a published offer or enters the subscription amount, skip deduction and dates, then clicks Approve & assign plan. Approval and subscription creation are saved together. Declined customers can resubmit through the same link with their existing password.

For testing on this PC: http://127.0.0.1:5173. For phones on the same Wi-Fi, run Vite with --host 0.0.0.0, and open http://192.168.68.121:5173 (this PC's current Wi-Fi address; it may change). Set Website address for this QR to that network address before downloading. Both devices must be on the same Wi-Fi and Windows Firewall must allow the dev server. No firewall settings are changed by this app. The QR is generated locally, without sending customer data to an external QR service.

The frontend now defaults to /api. Vite proxies /api to http://127.0.0.1:8000; set API_PROXY_TARGET=http://127.0.0.1:8001 for the isolated preview backend. For deployed builds, configure a reverse proxy for /api or set VITE_API_URL when building. Each mess has its own invite approval queue, menus, subscriptions and payment settings.

New join tables are managed by explicit migrations before backend restart. Existing accounts and manual registration continue to work. Integration check:
```powershell
$env:PYTHONPATH='backend'
backend/.runtime/Scripts/python.exe -m unittest test_join.JoinTests.test_join_approval_and_access
```

## Public mess page
The homepage now shows the mess's public details, address, meal timings, contact, live menu and preparation overview, with no login required. Owner dashboard → Your public mess page lets the owner edit these details. Blank fields display honest setup messages until the owner fills them in. Food imagery is illustrative.

Join my mess now links its QR to /mess/{token}. Visitors browse the public mess page, then tap Join this mess to reach /join/{token} and submit the existing registration request. Download the QR again after this update to use the new public-page destination; previously downloaded /join QR codes still open registration directly. Public here means no sign-in is needed; access outside your Wi-Fi still requires deployment to a reachable website.

## Owner workflow improvements
The homepage now prefers the configured mess profile rather than a seeded demo owner. Existing QR links stay owner-specific, so share the QR from the actual owner's dashboard. Pending join and subscription counts appear near the top of the owner dashboard and refresh every five seconds and when the window regains focus. One earlier request misrouted to the demo owner in preview.db was moved to the only configured real owner; its prior routing is recorded in output/request-routing-repair.json.

Customers create their account and verify their phone on the join form without choosing a subscription. The owner approves membership. After login and address setup, customers choose a subscription or single meal through Order food and complete payment for owner confirmation. Legacy join requests that already include a plan require owner-confirmed full payment before the subscription activates. Manual customer registration is removed from the dashboard; owner subscription assignment remains in Plans & subscriptions.

Public details are greyed out after saving and on subsequent visits. A pencil unlocks only the corresponding field. Meal timings use separate breakfast/lunch/dinner From/To dropdowns with 15-minute choices. Old text timings remain visible until replaced with structured timings.

Manage Meals lists reusable dishes (Daal, Roti, Raita, Salad, Rajma and Kadi) with plus and minus controls to add or remove them. Add new dish stores a custom choice immediately; dishes typed into the description appear in the list and persist after saving the meal (separate dishes with commas). Saved choices survive refreshes and are scoped to the owner.

## Image generation quota and menu saving
A live diagnostic on this setup confirmed Google HTTP 429: the configured project has zero free-tier image quota. The API key can list the image models, but generating requires enabling billing for its Google project. See https://ai.google.dev/gemini-api/docs/billing . The app cannot enable billing itself.

Menu saving no longer makes a second image request or waits for generation. Owners can save without a photo even when image generation fails or is still running. Setup failures stop automatic retries until Retry after fixing setup is clicked. Network failures now explicitly say the backend cannot connect to Google instead of reporting a generic generation failure. The preview backend needs outbound network access to Google's API.

## Pause feedback
Plans & pause now previews eligible published meals before submission and displays its result beside the pause button. It lists paused meals, skip deductions and the refreshed live bill, plus reasons for unchanged meals (already skipped, closed cutoff, dispatched, guest booking, outside subscription). A range with no menus explains that nothing can be paused yet; newly published future menus are still not automatically paused. Dates outside an active subscription show a clear error. Repeat pauses never deduct twice. The customer dashboard refreshes after meal changes or when the window regains focus.


### Cloudflare menu image setup (current provider)

Menu photos now use Cloudflare Workers AI FLUX.1 Schnell. In `backend/.env`, fill:

```dotenv
CLOUDFLARE_API_TOKEN=your_workers_ai_api_token
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
MENU_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell
```

Get both values from Cloudflare Dashboard > Workers AI > Use REST API. Use the Create a Workers AI API Token template (Workers AI Read and Edit permissions for your account). Use the API token, not the Global API Key. Keep credentials in the backend `.env` only. Restart the backend after editing, refresh the owner dashboard, and enter a menu or choose Retry after fixing setup. Photos are cached and reused; menu saving remains available if generation fails. Older Gemini setup instructions above are superseded by this section.

Provider reference: https://developers.cloudflare.com/workers-ai/get-started/rest-api/


## Customer checkout and meal feedback

After membership approval, customers must save a full delivery address before accessing their workspace. Saving it opens Order food, where they choose a dated subscription or buy one published meal to taste the food first. Owners set a separate single-meal price in Meals; leaving it blank disables individual ordering for that meal.

Checkout creates a bill immediately. Customers pay the owner's existing QR/UPI or hand over cash, then submit their payment for confirmation. No gateway or automatic collection is used. The owner confirms receipts in Payments; only full payment activates a new subscription or single-meal booking. Future plans and single meals also support the owner's Record received payments form. Part payments remain pending; unpaid checkouts without pending submissions can be cancelled. Price changes, repeat checkout requests, overlapping bookings and foreign mess records are checked by the API.

Meal history contains orders, subscriptions, payment submissions and confirmed receipts, as well as covered meals and skip/guest actions. An individual purchase books only the selected meal, so it does not count the customer for other meals that day and cannot be paused like a subscription.

The dashboard asks customers to rate their latest eligible meal the day after delivery is marked Delivered. It shows the meal photo/menu, five stars and an optional suggestion. Reviews sends feedback to the owner's dashboard panel, Meal ratings & suggestions. These are in-app updates; ratings are also included in existing public reviews. Skipped, unpaid and undelivered new checkout meals are excluded. Legacy owner-assigned subscriptions without delivery tracking retain their past-meal review behaviour.

The database migration adds nullable fields without replacing existing subscriptions, meals or payments. Backend regression tests cover checkout activation, single-meal counts, payment history, reviews, isolation and migration preservation.


## English and Hindi

The selector uses i18next/react-i18next and persists `mess-language` in the browser. Existing Hindi resources are retained, with sentence translations for customer and owner screens. `npm run check:translations` checks static rendered text and translation calls; `npm run test:language` and `npm run test:language-ui` verify language behavior. New static UI sentences still require a reviewed Hindi resource; runtime machine translation is reserved for saved descriptive content.

Dynamic saved menus, offer descriptions and public mess descriptions use the backend `/translations` endpoint. It accepts record identifiers and an allowlist of public fields, not arbitrary form text. English source values, names, addresses, IDs and amounts are not rewritten. Owner-provided Hindi descriptions take precedence. English is shown when credentials are missing, the provider is unavailable, or a protected value cannot be restored safely.

Set `GOOGLE_TRANSLATE_API_KEY` privately on the backend for Google Cloud Translation Basic (v2), enable that API and its billing, and restrict the key to the translation API. Never use a VITE-prefixed credential. Restart the backend after configuration. The default application limit is 50,000 requested source characters per UTC day per worker; configure `TRANSLATION_DAILY_CHARACTER_LIMIT` and provider-side project quotas for your budget. No live provider calls are made by tests.

Translations are batched and cached by content hash, language and protected names. Memory cache entries last 30 days with bounded size. For persistence across restarts and sharing between workers, configure `TRANSLATION_REDIS_REST_URL` and `TRANSLATION_REDIS_REST_TOKEN` for a separate Redis REST cache (such as Upstash). Cache storage does not modify the business database. No database migration is needed. The frontend restores original English immediately when the language changes; late Hindi responses do not overwrite English or form inputs.
