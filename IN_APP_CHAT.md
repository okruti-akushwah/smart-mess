# In-app owner/customer messaging

Customers: select a mess and click the floating **Chat** button at bottom right.
Owners: click **Chat**, choose a member from the dropdown and reply. Approved membership is
required. Customer messages cannot be read by other customers or other owners.

The button opens a compact popup without navigating away. There is no Messages
navbar item or standalone chat page. Close with ×, the launcher, or Escape.
Text messages persist in the database. Conversations and unread launcher badges
refresh every five seconds while the app is open. History loads in pages of 50;
use **Load earlier messages** for older entries. Failed sends preserve the draft,
and retries reuse an idempotency key to prevent duplicate messages. Messages
support up to 2,000 characters. A basic database-backed limit permits 30 messages
per minute per sender in a mess; it is not a strict concurrent traffic limiter.

There are no attachments, browser push notifications, SMS or emails. Message
contents are displayed as text, never rendered as HTML. Storage uses the normal
application database; this is not end-to-end encrypted chat.

## Deployment

Deploy both frontend and backend. Apply migration **0007_in_app_chat** before API
startup using the existing explicit deployment migration command:

```sh
python -m app.migrate upgrade
```

Run from `backend` with the production DATABASE_URL configured in the deployment
environment. No account or payment data is reset. API startup checks the schema;
it never applies migrations itself. The local `backend/local-demo.db` was backed
up before applying this migration. No live database was accessed.

The local backend was restarted on port 8000 to match the running frontend proxy.

## Validation

- Five isolated chat tests: two-way messages, unread/read cursors, duplicate
  retries, owner and customer isolation, pending-member denial, history and
  additive migration preservation.
- Seventeen migration regression tests.
- Frontend retry test verifies that failed drafts are kept and duplicate retry
  keys remain stable.
- Frontend lint, translation coverage and production build.
