# Try the Smart Mess demo

Open http://127.0.0.1:5174. All three accounts use password **Demo1234**.

| Account | Phone | What to explore |
| --- | --- | --- |
| Owner | 9000000001 | Menus, plans, approval, headcounts, delivery and payment recording |
| Active customer | 9000000002 | Meals, skip/undo, guests, bill, receipts, reviews and delivery |
| New customer | 9000000003 | A pending weekly subscription request |

1. Start with the active customer. Tomorrow's breakfast is skipped and lunch has a guest. Bills initially shows ₹3,000 subscription − ₹50 skip + ₹75 guest = ₹3,025; the sample ₹1,000 cash receipt leaves ₹2,025 due.
2. Undo the breakfast skip, then refresh Bills. The deduction disappears. Try skipping another open meal or adding a guest.
3. Open Plans & pause to pause published meals across a date range. Review a past meal under Reviews.
4. Log out and sign in as owner. Tomorrow's counts reflect the customer's changes. Approve the new customer's pending weekly plan from the dashboard.
5. Open Delivery. The active customer has a sample address and today's lunch is preparing. Advance its delivery status.
6. Open Payments. Record a small sample cash payment and then check the customer's receipt and balance. Upload your own QR to test the QR display; the demo does not provide a payment QR or process real payments.
7. Sign in as the new customer to see their approved subscription after step 4.

Demo menus and reviews are fictional. Everything above uses **backend/demo.db**, separate from the real database. Rerunning the seed adds missing records and preserves existing demo actions.

To start again after closing the servers, run `./start-demo.ps1` from the project folder, then follow the frontend command it prints in a second terminal. This uses API port 8002 and website port 5174.
