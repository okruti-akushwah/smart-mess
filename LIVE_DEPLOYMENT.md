# Deploy the current app and add live demo data

The local changes have not been pushed or deployed. The live demo accounts below are created only when the seed command succeeds. The seed adds a separate mess and preserves existing records; it never clears your live database.

## 1. Push the code

In PowerShell:

```powershell
cd C:\Users\akush\mess-manager
git add backend frontend .gitignore LIVE_DEPLOYMENT.md
git commit -m "Improve subscriptions, customer dashboard and checkout; add live demo seed"
git push origin main
```

The local `.env`, SQLite databases, payment uploads and private connection backup are ignored. Do not upload the local `.env` to Render: it now points to a local demo SQLite database.

## 2. Deploy the backend on Render

Open your existing backend service. Keep its production PostgreSQL/Supabase `DATABASE_URL` and stable `SECRET_KEY`.

Set `APP_ENV=production`. Startup rejects a missing or blank `SECRET_KEY`, an
unsupported `ALGORITHM` (use HS256, HS384 or HS512), or a non-positive/invalid
`ACCESS_TOKEN_EXPIRE_MINUTES` (default: 1440). Render requires a secret even when
APP_ENV is mistakenly set to development. Production never loads backend/.env.
Preserve your current secret exactly across all workers and restarts; rotating it
invalidates outstanding login tokens and console OTP challenges. Do not generate
a new secret during each deploy. Only development mode may generate a temporary
secret, with a warning; those sessions are not stable across processes.

New owner/customer accounts require passwords of at least eight characters
(maximum 72 UTF-8 bytes for bcrypt). Existing passwords remain valid, including
when an existing customer resubmits a join request; no password reset is forced.
JSON login, OAuth login and existing-account join password checks share database
attempt counters: ten attempts per account and 100 per client IP in a 15-minute
window. Successful authentication clears the account counter, not the IP quota.
Exhausted counters return HTTP 429 with Retry-After seconds. The additive
auth_attempt_buckets table is managed by the explicit migration command;
no customer or payment data is rewritten by API startup. All workers must use the same database.
Client IP comes from the ASGI connection, not arbitrary forwarded headers. If a
reverse proxy is used, configure the server to trust only that proxy for client
addresses. Database counters contain hashed identifiers, not passwords.

Local and live databases are separate: `backend/.env` configures local development only. Set the live PostgreSQL `DATABASE_URL` directly in Render Environment. The backend now refuses to start on Render if that setting is missing or points to SQLite, and never loads the local `.env` there.

Before saving environment changes or redeploying a service that previously used SQLite, use Render Shell (if available) to locate and back up its existing `mess.db`. A redeploy can discard that file. Connecting PostgreSQL does not migrate those records automatically. If the file is already gone, recovery requires a previous backup. Do not seed or reset databases during recovery.

With Root Directory set to `backend`:

| Setting | Value |
|---|---|
| Build command | `pip install -r requirements.txt` |
| Environment variable | `PYTHON_VERSION=3.12.11` |
| Pre-deploy command | `python -m app.migrate upgrade` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Branch | `main` |

If Root Directory is blank, use `pip install -r backend/requirements.txt` and `uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port $PORT` instead.
For that layout, use `PYTHONPATH=backend python -m app.migrate upgrade` as the pre-deploy command.

### First adoption of an existing database

API import no longer creates tables, runs backfills or initializes installation
records. Startup only checks the schema version and refuses an unmigrated schema.
Migration commands require an explicitly configured DATABASE_URL and never infer
their target from a local .env file. Preserve SECRET_KEY throughout this change.

Before the first deployment, take a verified backup and rehearse the migration on
an isolated copy. From the backend directory, run `python -m app.migrate status`
for a read-only inventory of pending revisions, missing fields and unsupported
legacy shapes. After reviewing it, run
`python -m app.migrate upgrade --allow-legacy-upgrade` once to adopt the existing
database. This is an additive upgrade, not a blind stamp: required columns are
checked, legacy helpers run inside one transaction, and revision 0001_baseline is
recorded only after successful validation. Unsupported schemas or constraint
failures roll back rather than deleting or merging records. No downgrade/reset
command is provided. Keep application writes quiescent during legacy adoption.

Fresh databases need only `python -m app.migrate upgrade`. After initial adoption,
keep the normal pre-deploy command without the legacy flag. Repeated upgrades
skip applied revisions and do not repeat historical backfills. PostgreSQL uses
a transaction advisory lock; SQLite uses BEGIN IMMEDIATE to serialize migrators.
Use a direct PostgreSQL migration connection when your pooler cannot support DDL.
Do not point a disposable test fixture at the live database.

### Backend dependency validation

`backend/requirements.txt` is the authoritative, version-pinned dependency lock for
both deployment and tests. `requirements-tested.txt` includes that file rather
than maintaining a second set of versions. Keep Render on Python 3.12.11; local
validation also supports Python 3.12.10. The lock preserves Uvicorn's standard
extras, APScheduler, bcrypt password compatibility, and both PostgreSQL drivers.
The Linux-only uvloop pin is skipped on Windows.

Before deploying dependency changes, validate in a fresh virtual environment
using Python 3.12. Do not run these checks against a production database:

```sh
python --version
python -m venv backend/.runtime/dependency-validation
backend/.runtime/dependency-validation/bin/python -m pip install -r backend/requirements.txt
backend/.runtime/dependency-validation/bin/python -m pip check
PYTHONPATH=backend backend/.runtime/dependency-validation/bin/python -m unittest discover -s backend -p test_dependencies.py -v
DATABASE_URL=sqlite:// SECRET_KEY=isolated-validation-secret SIGNUP_OTP_MODE=off APP_ENV=development RENDER=false PYTHONPATH=backend backend/.runtime/dependency-validation/bin/python backend/run_tests.py
```

On Windows, create an ignored validation environment with
`py -3.12 -m venv backend/.runtime/dependency-validation` and use
`backend/.runtime/dependency-validation/Scripts/python.exe` for the commands.
Set the environment variables with PowerShell before running the suite. Tests
use in-memory SQLite and temporary upload files; they do not validate live
PostgreSQL connectivity. Validate the Linux install in staging before deployment.
Do not copy an unrelated environment's `pip freeze` over the lock: retain the
extras and platform marker, and re-run dependency and application tests.

Use Manual Deploy → Deploy latest commit if auto deploy does not start. Wait until the service is live. The pre-deploy step applies pending migrations; API startup performs a read-only version check.

Check https://mess-manager-95v1.onrender.com/ and `/docs`. Confirm `/customer/account` appears in the API documentation.

Official instructions: https://render.com/docs/deploy-fastapi

### Isolated PostgreSQL integration tests

The regular runner forces in-memory SQLite, test secrets and temporary upload
storage before importing application code. Run it from the repository root with
`python backend/run_tests.py`; use `--pattern test_migration_runner.py` for migration
safety tests. PostgreSQL tests are skipped unless both explicit test settings are
present. Create a dedicated empty database named `mess_manager_test` or
`mess_manager_test_<suffix>` on a local/test server, then set:

```powershell
$env:RUN_POSTGRES_TESTS = '1'
$env:TEST_POSTGRES_URL = 'postgresql+psycopg://test_user@127.0.0.1:55434/mess_manager_test_batch4'
backend/.runtime/batch1-py312/Scripts/python.exe -B backend/run_tests.py --pattern test_postgres_integration.py
```

Fixtures reject other database names, create a random app_test_<uuid> schema,
verify the search path, and remove only their own schema after each test. They
never fall back to DATABASE_URL or .env. The test user needs schema-creation
permission in this dedicated database. Coverage includes concurrent migrators,
transaction rollback, API startup, join approval, confirmed payment and tenant
isolation. The default suite creates no PostgreSQL connection.

## 3. Deploy the frontend on Vercel

In your existing Vercel project:

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Production branch | `main` |
| Production environment variable | `VITE_API_URL=https://mess-manager-95v1.onrender.com` |

Redeploy after setting the variable. Open https://mess-manager-tau.vercel.app/ and refresh.

Official instructions: https://vercel.com/docs/frameworks/frontend/vite

## 4. Add realistic demo data once

Take a database backup/snapshot in Supabase before importing.

Open the deployed backend's Render Shell. If its working directory is `backend`, run:

```sh
SEED_LIVE_DEMO=YES python seed_live_demo.py
```

If the working directory is the repository root, run:

```sh
SEED_LIVE_DEMO=YES python backend/seed_live_demo.py
```

The script uses Render's configured `DATABASE_URL`. It requires PostgreSQL and the updated schema. It preserves existing data and refuses duplicate imports or occupied demo phone numbers. All database inserts are committed together. Never use `seed_local_realistic.py` to populate live.

If your Render plan has no Shell, use a local PowerShell session after deploying the backend. Enter the production PostgreSQL connection string privately when prompted:

```powershell
cd C:\Users\akush\mess-manager
$previousLiveDatabase = $env:DATABASE_URL
$privateLiveConnection = Read-Host 'Production PostgreSQL DATABASE_URL' -AsSecureString
$env:DATABASE_URL = [System.Net.NetworkCredential]::new('', $privateLiveConnection).Password
$env:SEED_LIVE_DEMO = 'YES'
try {
    & backend/.runtime/Scripts/python.exe backend/seed_live_demo.py
    if ($LASTEXITCODE -ne 0) { throw 'Demo import failed; read the error above.' }
} finally {
    $env:DATABASE_URL = $previousLiveDatabase
    Remove-Item Env:SEED_LIVE_DEMO -ErrorAction SilentlyContinue
    Remove-Variable privateLiveConnection
}
```

This keeps the connection string out of shell history and restores the terminal's prior database setting. Do not paste it into chat.

The import creates Annapurna Homestyle Kitchen, 13 customers, 45 date-relative menus, four offers, ten subscriptions, two paid personal meal orders, payment records, a payment awaiting review, and six reviews. One customer has no subscription or orders.

## 5. Log in after the import succeeds

| Account | Phone | Password |
|---|---|---|
| Owner: Rajesh Kulkarni | `9100000001` | `DemoKitchen#2026!` |
| Subscribed customer: Aarav Sharma | `9100000002` | `DemoKitchen#2026!` |
| Customer without subscription: Aditya Menon | `9100000014` | `DemoKitchen#2026!` |

Owner login: https://mess-manager-tau.vercel.app/owner/login

Customer login: https://mess-manager-tau.vercel.app/login

The new mess appears in the mess directory; the original installation's default mess remains unchanged. Open the demo owner's Public page to get its specific customer join link. Seeded payments are sample records, not actual money transfers. The seed intentionally supplies no payment QR or payable UPI ID; upload your owner's real QR from Payments when you want to enable real payment.

Demo food photos are copied into the backend's generated images directory. For ongoing uploads, use persistent storage: Render's default filesystem does not preserve uploads across deploys. Database records persist in PostgreSQL. See https://render.com/docs/disks.
