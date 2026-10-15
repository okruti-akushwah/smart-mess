# AI Kitchen Advisor

Owner navbar → AI Kitchen Advisor. Replaces the former Smarter Meals calculator;
old `/owner/smarter-meals` links redirect to `/owner/kitchen-advisor`.

## Configuration

Backend environment only (local `backend/.env`, or Render Environment for live):

```dotenv
GEMINI_API_KEY=your_private_key
KITCHEN_ADVISOR_MODEL=gemini-3.1-flash-lite
```

Restart the backend after changing environment settings. Deploy both frontend and
backend for live use. No migration, new dependency, or database seed is needed.
The current local Gemini key successfully generated a structured summary of the
fictional sample reviews during implementation. Live hosting credentials and
quota must be configured independently; do not put the key in a VITE variable.

## Presentation in one minute

1. Open AI Kitchen Advisor as owner.
2. Select **Try sample reviews**. The banner explicitly labels them fictional.
3. Expand **Read the source reviews**: show rice and delivery complaints mixed
   with positive feedback about dal and rotis.
4. Click **Analyze feedback**. This makes a real Gemini request, unless the same
   input has a cached analysis from the previous 15 minutes.
5. Show the summary and three columns: what customers love, what needs attention,
   and what to do next. Expand supporting reviews under a finding.
6. Say: “We turn customer feedback into practical kitchen improvements, and
   every AI finding links back to the feedback behind it.”

**My customer reviews** analyzes up to 100 reviews created within the last 7 or
30 days for the authenticated owner only. Average ratings and counts are
calculated by the application, not invented by AI. Names and account details are
excluded from the provider payload; email addresses and phone-like strings in
comments are masked. Free text may still contain other personal information.

Results are suggestions, not guaranteed facts. Evidence IDs are validated, but
the model's interpretation still needs owner review. The feature never edits
menus, sends messages, or writes reviews. Sample mode never adds database rows.
Unavailable providers produce an explicit error, not a fake AI summary.

The cache and 15-second per-owner request cooldown are per backend worker and
reset on restart. Use provider-side spending limits for production cost control.

## Checks

`python backend/run_tests.py --pattern test_kitchen_advisor.py` runs isolated tests
for access controls, owner isolation, periods, sample mode, cache, redaction,
provider quota errors, and unsupported evidence references. Frontend lint,
production build and translation coverage also passed during implementation.
