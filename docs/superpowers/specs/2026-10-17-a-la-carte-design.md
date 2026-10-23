# A la carte additions to booked meals

Date: 17 October 2026. Status: user-approved and implemented locally; verification limits are recorded in output/nearby-extras/verification.md.

## Intent and scope

Implement request 2: a customer can order extra dishes alongside their regular booked meal, and payment reflects those additions. Support active subscriptions and paid, owner-accepted single-meal bookings in the selected mess. An extra order requires an eligible booked meal; independent restaurant-style checkout is outside this first version. Request 3, the dashboard menu redesign, is excluded. Existing meal menus and dashboard layout stay intact except the controls and records needed for this feature.

## Approach and alternatives

Use structured extra-order records linked to an existing meal and booking. Reusing MealOrder.extra_items/extra_cost would collide with guest bookkeeping and skip resets. A separate marketplace checkout would require a wider payment and fulfillment model. Structured additions preserve guest charges and reuse the existing cumulative booking-bill/payment workflow.

## Owner catalogue

Create an owner-scoped ALaCarteItem with ID, English name and description, optional explicit Hindi equivalents, price as Numeric/Decimal with two decimal places, availability, and allowed meal types. Name is 1-100 trimmed characters, description at most 500, price greater than zero and at most Rs 10,000. Meal types are a nonempty unique subset of breakfast/lunch/dinner. Categories, inventory counts, tax changes, image uploads and discounts are not required for this version.

Add an item management section to the existing routed owner meal-management page. Owners create, edit, and mark items unavailable. Archive rather than delete referenced items. Catalogue changes do not alter previously confirmed order snapshots. A compact catalogue section is functional scope, not the deferred dashboard redesign.

Proposed owner endpoints: GET/POST /owner/a-la-carte/items and PUT /owner/a-la-carte/items/{id}. Customer GET /customer/a-la-carte/items?meal_id=… returns the available catalogue for an eligible meal. Enforce owner tenancy through the existing scope mechanism, including registration of every new owner-scoped model.

## Customer ordering

Expose Add extras beside eligible booked meals. Reuse the existing accessible Dialog and button primitives. List item names, descriptions, unit prices, quantity inputs, subtotals, and the complete extra-order total. Show the meal/date and explain that charges are added to the booking bill. Preserve English/Hindi overrides and locale-aware amounts.

POST /customer/a-la-carte/orders accepts meal_id, booking plan_id, a UUID purchase_key, and unique item lines containing item_id, quantity (integer 1-100), and expected unit price. Limit a request to 30 distinct lines. The server validates all lines, computes Decimal totals, and commits the complete order atomically. A stale price or unavailable item yields a conflict and requires refreshed review. A retry with the same key and same canonical payload returns the original order; a different payload with that key conflicts. The UI retains the key across retries of the same submission and disables duplicate clicks while pending.

Only the authenticated customer with an approved membership, saved valid delivery address, and active booking covering the selected meal may order. The meal must not be skipped, past cutoff, dispatched, or previously delivered. Validate cutoff and booking again inside the write transaction using the existing customer lock. Reject cross-mess item, meal, or booking IDs.

Store an ALaCarteOrder header with owner_id, user_id, plan_id, meal_id, purchase_key, created_at, total and confirmed status, plus ALaCarteOrderLine records with item ID, quantity and immutable English/Hindi name and unit-price snapshots. Confirmation commits the order and its bill together. Customer self-service cancellation and paid refunds are excluded; display that confirmed extra orders require contacting the owner for changes. Do not add a misleading cancel control.

Confirmed extras are an order commitment, analogous to adding guests. Block a subsequent meal skip, date pause, or any other booking mutation that would invalidate that commitment, with a clear explanation. This adds a guard for the new feature while preserving existing behavior for meals without extras. Subscription extension calculations and guest counts remain unchanged.

## Bills and payments

Keep plan base prices unchanged. Calculate extras_total as existing guest charges plus confirmed a la carte orders belonging to that booking. Use explicit plan_id linkage to prevent duplicate charges across overlapping bookings or later subscriptions. Include itemized extra-order lines in current bills, issued bill output, customer history, owner billing views, and receipts where the related bill is displayed.

When an extra order is confirmed, create the next cumulative IssuedBill for the same booking if totals changed. Its final amount is base minus existing deductions plus existing guest charges plus confirmed extra orders. Preserve old issued bill snapshots. Serialize with payment writes using the existing customer lock so order creation and payment confirmation cannot lose or duplicate charges.

Confirmed PaymentRecords remain credited to the same plan exactly once. The new balance is cumulative bill total minus previously confirmed payments, clamped according to current behavior. Submitted payment proof remains pending until owner confirmation. Stale bill payment attempts retain current mismatch/conflict handling and direct users to the latest bill; never silently mark new extras paid because the base plan was paid. Adding extras must not deactivate an existing active booking or rerun meal acceptance.

Extend the existing bill calculation path to cover an explicitly selected eligible single-meal booking as well as a subscription, without changing default /bills/current selection. Reuse /customer/checkout?bill=<id> and BillWorkflow for paying the updated bill; ensure the returned checkout status copy can describe an active booking with an outstanding extra balance. Existing plan checkout overlap and activation logic must not be repurposed to create an extra order.

## Preparation and history

Owner preparation shows extra quantities grouped by item for each meal and customer-level order details with the existing delivery address/contact information. Extras do not inflate meal headcount or guest count. Preserve the existing polling intervals. Customer meal history exposes ordered names, quantities, unit prices and total; archived catalogue entries remain readable from snapshots.

Proposed read endpoints: GET /customer/a-la-carte/orders and GET /owner/a-la-carte/orders, with existing tenancy/role checks and optional meal filtering. Avoid automatic order acceptance or automatic payment approval.

## Integration and migration

Use the existing migration runner for new tables, indexes and uniqueness constraints. Existing records require no fabricated item or location data. Register the new routes in app/main.py. Keep focused ordering/billing helpers separate from the large route files. Likely existing consumers include tenancy.py, billing_routes.py, workflow_routes.py, payment_routes.py, purchase_routes.py, meal_routes.py, date_pauses.py, preparation.py, CustomerDashboard, ManageMeals, BillWorkflow, PersonalOrders and history pages. Inspect all skip, dispatch, receipt and payment paths before editing.

## Acceptance and verification

Backend tests must cover owner/customer and cross-mess isolation; catalogue validation/archive; subscription and single-meal eligibility; cutoff/dispatch/skip/address guards; Decimal totals; immutable price snapshots; stale-price conflicts; idempotent retries and payload conflicts; transactional rollback; coexistence with guests; skip/pause guards; and item preparation quantities without changed headcounts.

Payment tests must prove: a paid Rs 1,000 booking plus two Rs 20 extras yields a Rs 1,040 cumulative total and Rs 40 balance; prior payments are not duplicated; pending proof is not treated as paid; old bill snapshots stay unchanged; concurrent ordering/payment is serialized; and the same extras are never charged to another plan. Retain existing guest, pause, extension, purchase, billing, receipt and multi-mess regression coverage.

Frontend tests cover quantity limits, totals, unavailable items, price refresh, failed submission/retry, keyboard/focus behavior, pending controls and correct bill links. Run build/lint and translation checks. Review phone/desktop and English/Hindi renders, including long mixed-script item names and loading/empty/error states. Record runtime or test limitations explicitly. Do not deploy, submit real payments, or alter unrelated working-tree changes.
