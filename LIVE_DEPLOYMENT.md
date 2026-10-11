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

With Root Directory set to `backend`:

| Setting | Value |
|---|---|
| Build command | `pip install -r requirements.txt` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Branch | `main` |

If Root Directory is blank, use `pip install -r backend/requirements.txt` and `uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port $PORT` instead.

Use Manual Deploy → Deploy latest commit if auto deploy does not start. Wait until the service is live. Startup creates the new tables and applies the subscription migrations without deleting existing records.

Check https://mess-manager-95v1.onrender.com/ and `/docs`. Confirm `/customer/account` appears in the API documentation.

Official instructions: https://render.com/docs/deploy-fastapi

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
