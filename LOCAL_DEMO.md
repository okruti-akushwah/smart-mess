# Local test data and verification

The local backend now uses `backend/local-demo.db`. Render keeps its own environment configuration; the live PostgreSQL database was not seeded or changed by this work. Previous local data and connection settings are backed up privately in `output/local-demo-backups/` (ignored by Git).

Open http://127.0.0.1:5173. All sample accounts use **Demo1234!**. Names, addresses, payment references and orders are fictional. Do not make real payments to test these records.

| Phone | Account | Scenario |
| --- | --- | --- |
| 9000000001 | Rajesh Kulkarni, owner | Annapurna; weekly menus, members, billing, delivery and reviews |
| 9000000102 | Neha Kapoor, owner | Saffron; separate permissions, pending and rejected join requests |
| 9000000103 | Arun Nair, owner | Coastal; new kitchen with empty menus and plans |
| 9000000002 | Aarav Sharma | Approved subscriptions at Annapurna and Saffron |
| 9000000003 | Priya Mehta | Pending Saffron request, guest meal, partial payment |
| 9000000004 | Rohan Desai | Rejected Saffron request, payment awaiting review, delivery in progress |
| 9000000005 | Sneha Patil | Saved future pause and historical skip |
| 9000000012 | Arjun Verma | Paid personal order awaiting owner acceptance |
| 9000000013 | Tanvi Gupta | Accepted personal order |
| 9000000020 | Vikram Sethi | Expired subscription |
| 9000000021 | Aditi Menon | Future subscription |
| 9000000022 | Farhan Ali | Awaiting payment, rejected payment submission |
| 9000000030 | Kavya Iyer | Common account with no mess membership |

There are 3 owners, 16 customers, 65 dated meals, 21 weekly entries, active and archived offers, delivery addresses, reviews, full/partial/pending payments, a meal without single-meal ordering, and past/future cutoff cases. Dates are relative to the day the seed runs in India.

## Restart locally

Backend, from `backend`:

```powershell
./.runtime/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Frontend, from `frontend`:

```powershell
$env:API_PROXY_TARGET = 'http://127.0.0.1:8001'
npm run dev
```

The demo currently runs on those ports. Reuse the running servers instead of starting duplicate instances. Sign out and back in after reseeding. To reset and regenerate only this local data, run `./.runtime/Scripts/python.exe seed_local_realistic.py` from `backend`. This script explicitly selects the local SQLite file before importing the app database.

## Verification and fixes

The 158-test isolated backend suite covered signup/login, memberships, owner isolation, menus, checkout, payment approval, receipts, deliveries, skips, pauses, subscription extensions, reviews, migrations and translation fallback. Four PostgreSQL-only cases were skipped because no dedicated test PostgreSQL database was supplied. The first run found local dependency mismatches and an outdated test expecting common customer registration to fail. Installed the locked dependencies, updated that test to verify unassigned common accounts, and reran all affected groups successfully.

Browser checks exercised owner/customer login and two-mess selection at a narrow viewport. Fixed mess selection returning customers to the homepage, with two regression tests covering normal dashboard navigation and preserved checkout destinations. Mess cards now show city/area, food type and service type; search includes city and area. Corrected the empty-meals guidance after the section was reordered.

Frontend lint, production build, static translation coverage, 11 language UI tests and 2 navigation regression tests passed. This does not establish that every possible scenario is bug-free. Real SMS, external translation, actual UPI transfers and hosted deployment behavior were not exercised; these require configured providers. Existing payment logic was preserved. There is no admin account/dashboard in the current backend role model to test.

Detailed local test logs are under `output/audit/`. Backups and logs should not be uploaded to GitHub.
