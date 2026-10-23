# Smart Mess design system and redesign proposal

Status: all applicable original redesign batches (1–5, 7 and 8) and follow-up audit batches A–E are implemented with documented verification limits. Batch 6 is not applicable because there is no admin dashboard. The user subsequently approved a brighter, interactive visual refresh: green/amber remains the anchor, with light mint, peach, lilac, sky and lemon task surfaces, food photography, icon-led shortcuts and a linked meal journey. Updated 16 October 2026.

## Scope and evidence

This document defines the target system, a source-based UI audit, and an incremental implementation plan. The initial documentation phase changed only DESIGN.md, AGENTS.md, and .agents/skills/ui-design/SKILL.md. The user subsequently approved Batch 1 styling foundations. Routes, APIs, authentication, billing calculations, membership rules, and translation resources remain outside that batch.

The initial audit inspected frontend routes, components, styling, localization and tests without a local preview. Later implementation and follow-up audits used the running local app, real screenshots and selected keyboard/interaction checks, recorded in the batch verification reports. Those samples do not establish exhaustive state coverage or accessibility compliance.

## Architecture and route inventory

- React 19, JavaScript/JSX, Vite 8, React Router 7; Axios for requests; i18next/react-i18next for English and Hindi. No Tailwind, component framework, or dedicated design-system library is declared in frontend/package.json.
- frontend/src/main.jsx loads styles/tokens.css, index.css, ui-refresh.css, tiffin-theme.css, then owner-tab-backgrounds.css. Feature styles are imported by their components/pages. Global selectors and repeated overrides make effective styling dependent on specificity and stylesheet order. App.css exists but is not imported by App.jsx or main.jsx; check all consumers before treating it as active or removing it.
- App.jsx owns routing and wraps the application in LanguageProvider; ChatWidget is mounted globally. ProtectedRoute and the address/membership gates enforce existing access flows. Navbar is reused throughout authenticated pages. Keep these boundaries.
- Public: / renders MessDirectory, /explore renders Explore, /mess/:token renders MessPublic, and /join/:token renders JoinMess. Home.jsx is not the root route. Do not redesign an unused page in place of the real landing page.
- Authentication: /login, /register; /signup redirects to /register. /owner/login and /owner/register are aliases. Preserve return destinations, role selection, OTP verification, and signup settings.
- Customer: /customer, /customer/messes, /customer/address, /customer/choose, /customer/checkout, /customer/plans/browse, /customer/plans, /customer/pause, /customer/history, /customer/bills, /customer/reviews. Preserve query strings, bill IDs, mess selection, and meal anchors.
- Owner: /owner, /owner/onboarding, /owner/meals, /owner/requests, /owner/customers, /owner/plans, /owner/bills, /owner/settings, /owner/payments, /owner/reviews, /owner/public-page, /owner/kitchen-advisor. OwnerWorkspace composes requests, customers, plans, bills, and settings using existing feature components.
- /owner/messages and /customer/messages redirect to their dashboards; chat uses ChatWidget and Messages-related components. Delivery routes also redirect to dashboards. Preserve this behavior; file existence does not imply a live standalone route.
- No admin route or admin dashboard was found in App.jsx or the frontend admin search. Admin UI cannot be audited as an implemented surface. Do not invent one under a visual redesign.
- Existing reusable assets include Icon, MenuImage, DynamicText, BillWorkflow, PaymentOptions, PublicReviews, WeeklyMenuEditor, and language utilities. Extend these before creating parallel implementations.

## Brand and design philosophy

Smart Mess is a dependable daily workspace for local Indian kitchens and their members. The identity should communicate warm hospitality, clear commitments, and reliable records. Keep the food context through the existing thali imagery on public pages, actual meal cards, kitchen names, and bright, light surfaces. Dashboards use compact text introductions rather than welcome illustrations, with genuine secondary route shortcuts in consistent category tints and clearly labeled illustrative food photography. Avoid decorative metrics and status meaning conveyed by color alone. Operational shortcuts use border feedback without hover movement; retain reduced-motion support.

Public pages can be inviting and editorial; workspaces must prioritize today's meals, actionable requests, and clear payment status. Use plain task names and short explanations for nontechnical users. Give each section one dominant action. Never imply a payment has cleared merely because proof was uploaded, or imply an illustration is a vendor's actual meal.

The approved platform name is Smart Mess. Preserve this name in future UI work. The routed public, authentication and workspace navigation surfaces use Smart Mess, retaining each owner's mess name as local context. Reuse the existing meal Icon as the platform mark. Matching Hindi resources preserve the platform name; do not change user-entered kitchen names. Legacy translations and the unrouted Home module may retain earlier Smart Mess copy for compatibility.

## Bright visual refresh (approved 16 October 2026)

Decorative task surfaces: mint `#E4F6EB`, peach `#FFF0E3`, lilac `#F0ECFF`, sky `#E9F3FF`, lemon `#FFF6CF`. Use the existing dark text on these surfaces. Lilac icon ink is `#615098`; sky icon ink is `#315F8B`. Card radius is 20px. These tints identify tasks rather than payment states. Keep real vendor/menu images where available; label bundled discovery and welcome photos as illustrative. City chips filter existing data. Meal journey links expose existing routes and preserve checkout query strings; they never assert payment or membership completion. Light mode remains the shipped theme.

Approved follow-up B–E: discovery search belongs beside the hero's primary task, with suggestions only from loaded kitchen/city data and one labeled results region. Public meal links say “View meal and availability” because membership/cutoff checks happen downstream. A compact three-column meal journey marks the current step; payment is plain information until checkout exists. Catalogs initially show the next three menu dates, with explicit access to all dates, date/type/booking filters and reset feedback. Selected meal hashes expose all dates so the target remains reachable. Plan date helpers require an explicit click; show the existing end date and retain overlap guards. Keep skip/date terms in a named native disclosure, not removed. Authentication keeps native labels/validation/autocomplete and adds a reversible password-visibility control. Owner workspaces use plain compact headers, grouped member records, separated payment-review actions and real anchors between publishing and assignment. Review submitted payments before QR configuration; confirmation and recording remain distinct operations.

## Nearby discovery and meal extras (approved 17 October 2026)

The approved feature follow-up adds 4 km/10 km discovery and à la carte additions to booked meals. Directory distance controls sit in the existing results area and preserve name/city/area search. Following the 17 October presentation update, hide device accuracy and per-kitchen distance readouts. Use a compact location status and grouped radius filters; retain ordinary discovery when device location fails. Kitchen coordinates belong to the existing owner profile save boundary.

Owner Manage Meals keeps its existing heading and weekly editor, with an anchor to the additional à la carte catalogue. Customer meals gain a compact Add extras action and reuse the existing named Dialog for quantities and totals. Bills and order history display immutable item names, quantities and unit prices; distinguish active bookings with an additional balance from unpaid bookings. Owner preparation lists extra item quantities separately from meal and guest counts. Preserve the existing palette, typography, routes, gates and payment-confirmation meaning. The separate dashboard menu redesign remains deferred by the user's choice to proceed with requests 1 and 2 only. Evidence and limitations: output/nearby-extras/verification.md; manual tests: output/nearby-extras/TESTING.md.

Extra-order preparation records use compact bordered cards: customer/date/meal and confirmed status at the top, aligned dish quantities and amounts, a mint total row, then grouped delivery address, instructions and phone link. Cards form two columns where space permits and stack on phones. Retain every order detail and existing bill destination; other bill item displays keep their existing layout.

Today's personal orders and orders awaiting acceptance follow the same compact card hierarchy, with distinct payment/acceptance states, grouped amounts, and delivery information. Completed meal records show labelled meal, skip, guest and personal-order counts in a two-column definition list. Keep existing acceptance guards, notifications, polling and preparation calculations unchanged.

## Approved UX audit corrections

Header navigation refinement (19 October 2026): the shared authenticated header uses a compact light two-row workspace bar: brand context and a quiet green menu square on the first row, then the current workspace and utility controls on the second. Keep the existing green/white palette; language is compact, notification sound is an aligned icon control, and logout is visually secondary. Tablet layouts retain the compact control shape and mobile retains the brand/menu row with utilities below it. The accessible menu label, dialog behavior, keyboard support and all customer and owner destinations remain unchanged.

Workspace navigation uses the shared right-side Drawer rather than the centred Dialog used by forms and notifications. The drawer keeps the page visible behind a subtle backdrop, locks background scrolling, supports Escape and backdrop dismissal, returns focus to the trigger, and uses the existing role-specific route list and active state. It is 360px wide on desktop and has 8px safe margins on small screens. Utility controls are 36px compact controls in a tightened second header row.

At 1100px and above, the workspace header exposes the same role-specific route list as an inline, horizontally scrollable desktop navigation row between the brand and utilities. The active route uses the existing green secondary surface. Below that breakpoint, the compact menu trigger and Drawer remain the navigation pattern.

The workspace header is sticky: it hides after an intentional downward scroll and reappears as soon as the user scrolls upward or returns near the top. This keeps compact language and account controls available without making them persistent page content.

Approved UX audit follow-up, Batch 1 (17 October 2026): new route destinations start at the top and receive focus as their heading becomes available; intentional meal hashes keep their existing handler, and browser Back restores the saved position until user interaction. Customer checkout and bill summaries show separate guest and extra-dish charges using existing response data, with authoritative API totals, confirmed payments and amount due retained. Historical bill snapshots are collapsed and labelled as previous bills with a link to the current bill; only the latest payable bill offers payment. Public header/footer registration links use the owner registration route, and sign-in/account links preserve owner intent. Keep the existing palette and payment/access rules. Verification: output/ux-batch1/verification.md.

Approved UX audit follow-up, Batch 2 (17 October 2026): expose the existing language selector on the public directory and preserve matches across English/Hindi searches. Directory prices are explicitly requested per kitchen from existing published menu/plan data, with duration, partial failure and retry states. Explore identifies the selected kitchen and separates Menu, Plans & prices and Reviews before the catalog; public selection retains that kitchen through the existing join/approval handoff. Pending members can refresh status, view published contact details or find another mess. Booked-meal return links reveal and focus the matching dashboard card, and delayed public contact anchors receive focus. Native sign-in help explains existing options without inventing password recovery, contact details or approval deadlines. Preserve role/access gates, transaction rules, green/amber styling and bilingual content conventions. Verification: [UX Batch 2](output/ux-batch2/verification.md); [manual test guide](output/ux-batch2/TESTING.md).

Approved UX audit follow-up, Batches 3–7 (17 October 2026): customer management shows one date at a time, retaining explicit unavailable dates and meal-hash context. Public menus narrow by date/type; account history filters across messes/status/dates and reveals more records explicitly. Active-booking payment pages keep booking context; proof forms start with an empty amount and distinguish external payment from confirmation. Owner basic public details precede optional enrichment; empty kitchens see setup before unavailable statistics. Saved/unsaved form status reflects persisted data rather than setup navigation. Weekly editors focus the selected slot, use typed dishes first and disclose saved choices; published offers can prefill supported manual-assignment fields without changing assignment rules. Pending payment review precedes searchable history and disclosed QR setup. Concise content, accurate signup stages, bilingual labels, full-width narrow radius controls, compact operational photos and accurate saved/draft image metadata complete the presentation work. Keep green/amber, existing endpoints/gates, transactions, polling and all available fields. Final frontend checks: 118 UI tests and 26 service/language tests passed; lint, translation coverage and build passed. Isolated backend checks: 178 passed, 4 PostgreSQL cases skipped, one previously recorded exact-response assertion failure; no backend source changed. Real-user research, screen-reader and physical-device/true-zoom checks remain unperformed. [Consolidated changes](output/ux-remaining/CHANGES.md), [verification and limits](output/ux-remaining/verification.md), [testing guide](output/ux-remaining/TESTING.md).

## Color tokens

Use semantic CSS custom properties in the existing stylesheet system. The role contracts below are defined in frontend/src/styles/tokens.css in Batch 1; legacy feature styles will migrate incrementally. Raw palette values should be centralized; components consume roles rather than palette indices.

| Role/token | Light | Dark | Use |
| --- | --- | --- | --- |
| --color-brand | #17774E | #8BD4A7 | Primary identity, links, selected controls |
| --color-brand-hover | #10613E | #ADE7C3 | Pointer hover |
| --color-brand-active | #0B4C30 | #70C491 | Pressed state |
| --color-on-brand | #FFFFFF | #102318 | Filled primary text |
| --color-secondary | #E4F6EB | #243B2C | Quiet green surfaces |
| --color-accent | #F7CE68 | #F2C66D | Small amber highlights |
| --color-on-accent | #48320D | #48320D | Text on amber |
| --color-accent-ink | #805411 | #F2C66D | Amber text on base surface |
| --color-canvas | #F7FAF7 | #131B17 | Page background |
| --color-surface | #FFFFFF | #1C2821 | Cards, forms, menus |
| --color-surface-subtle | #F0F2EB | #243329 | Secondary regions |
| --color-text | #20382A | #EDF3EC | Main text |
| --color-text-muted | #58685C | #B7C5B8 | Supporting text |
| --color-border | #DCE3D8 | #405246 | Decorative separation |
| --color-control-border | #7B8C7E | #82998A | Inputs and essential boundaries |
| --color-focus | #256343 | #A5E2B8 | Focus ring |
| --color-success | #21603D | #91DBAE | Confirmed success |
| --color-warning | #805411 | #F2C66D | Pending/requires attention |
| --color-danger | #B33332 | #FFAAA6 | Errors/destructive actions |
| --color-info | #235D82 | #A1D3F2 | Neutral informational status |

Semantic tints: success #EDF6EF, warning #FFF4D9, danger #FFF0EE, info #EDF5FA; dark equivalents #213B2B, #3B321D, #422726, #203440. Use matching semantic ink and readable text; never status color alone. Amber is an accent, not a substitute for warning labels. Decorative pale borders are not sufficient as essential control boundaries.

These pairings are design candidates. Measure final contrast in context, including disabled-adjacent text, images, composited backgrounds, hover, and focus. Target WCAG 2.2 AA: 4.5:1 normal text, 3:1 large text and essential non-text UI. Underline inline links or provide another persistent non-color cue.

## Light and dark theme strategy

Light is the initial rollout default, matching the warm existing brand. Define both token sets so new components avoid hardcoded light surfaces. Implement dark mode only as a complete, separately verified presentation change within approved scope; do not advertise a switch while major screens remain light-only. A future selector may use system preference with an explicit saved override and color-scheme for native controls. Preserve language preference independently. Do not invert food photos, QR codes, proof images, or receipts; keep QR backgrounds white and scannable. Test overlays, charts, disabled states, and native date/select controls in both themes before shipping dark mode.

## Typography and bilingual layout

Reduce the current Inter + DM Sans + Manrope + Lora mix. Use DM Sans for English body and application headings, retaining Lora only for English public editorial headings. Use Noto Sans Devanagari for Hindi and mixed-script fallback: body stack 'DM Sans', 'Noto Sans Devanagari', system-ui, sans-serif. Hindi headings use Noto Sans Devanagari rather than forcing Latin serif styling. Initially reuse existing fonts; add only the needed Devanagari family during the approved font batch. Prefer a deliberate loading strategy with fallback and font-display: swap; no font-library dependency.

| Role | Size | Weight | Line height |
| --- | --- | --- | --- |
| Public display | clamp(32px, 4.5vw, 56px) | 600 | 1.2 English / 1.4 Hindi |
| Page title | 28–36px | 700 | 1.25 / 1.45 |
| Section title | 22–24px | 600–700 | 1.35 / 1.5 |
| Card title | 18–20px | 600 | 1.4 / 1.5 |
| Body and mobile inputs | 16px | 400 | 1.6 / 1.7 |
| Dense desktop table | 14px | 400–500 | 1.5 / 1.65 |
| Labels/buttons | 14–16px | 500–600 | 1.45 / 1.6 |
| Supporting metadata | 13–14px | 400–500 | 1.5 / 1.65 |
| Operational totals | 28–40px | 700 | 1.2 / 1.4 |

Avoid essential 10–11px copy, excessive uppercase, weight 800 everywhere, and negative tracking on Hindi. Use natural content height and wrapping; never clip matras or constrain translations to English dimensions. Keep document lang synchronized through LanguageProvider. Preserve useTranslation, DynamicText, explicit Hindi fields, locale-aware dates, ₹ amounts, and existing fallback semantics. Use tabular numerals for comparable totals; do not change stored numeric values or billing formulas. Test English, Hindi, mixed names, long addresses, and long plan titles.

## Spacing, layout, surfaces

- Base spacing: 4px. Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px. Use 8–12 inside controls, 16–24 inside cards, 24–32 between sections, and 48–64 between public marketing sections.
- Content: public max-width 1180px; operational max-width 1280px; reading width 65ch; auth form 440px. Page gutters 16px mobile, 24px tablet, 32px desktop. Forms remain compact rather than stretching fields across wide screens.
- Breakpoints: base 320–639px, small/tablet 640–767px, tablet 768–1023px, desktop 1024–1279px, wide 1280px+. These are target conventions; migrate existing 380/480/520/550/600/850/900/1100/1350 rules by component after verification rather than deleting them wholesale.
- One column on phones; two columns where content permits on tablets; up to three meal cards on desktop. Use minmax(0, 1fr), wrapping and intrinsic sizing. No document-level horizontal overflow at 320px. Wide data tables can scroll inside a named region.
- Radius: controls 10px, cards 20px, dialogs 20px, pill 999px for compact status/chips only. Do not make all controls capsules.
- Shadows: small 0 2px 6px rgba(20,45,30,.06), raised 0 8px 24px rgba(20,45,30,.10), overlay 0 16px 48px rgba(10,25,16,.20). Default cards use a quiet border; reserve elevation for real hierarchy. Dark surfaces use borders more than shadows.
- Layer contract: base 0, sticky header 20, dropdown 40, chat 50, modal backdrop/dialog 80/81, toast 100. Review actual stacking contexts before migrating existing z-index values.

## Components and states

### Buttons and links

Primary is green with on-brand text; secondary is outlined; tertiary is a plain text action; destructive is explicitly labeled with danger styling. Default minimum control height 44px, comfortable touch size 48px; dense desktop controls may be smaller only with adequate target spacing and a 24px WCAG minimum target. Icon-only actions need localized accessible names. Do not rely on hover tooltips for why an action is unavailable.

Hover changes surface/color; active adds a subtle inset or color shift. Avoid moving routine workspace controls on hover. Focus-visible uses a 2–3px ring with 3px offset, contrasting against both control and surroundings. Disabled controls remain recognizable, have no hover motion, and get nearby explanatory text when task-relevant. Loading preserves width and action label, adds progress text/spinner and aria-busy, and uses existing pending guards to prevent duplicate actions. Do not change request behavior.

### Inputs and forms

Persistent visible label; 44–48px input height; readable 16px mobile text. Include optional/required information and helper text before submission. Associate errors with aria-describedby and aria-invalid; preserve entered values. Use fieldsets/legends for grouped choices. Distinguish readonly, saved-and-locked, disabled, error, and loading. Restore visible input/select/textarea focus. Do not replace native controls without a concrete usability reason. Preserve browser autocomplete, validation, OTP behavior, and submit handlers. Provide one clear save action per existing save boundary.

### Cards, meals and subscription plans

Cards group a task, not every line of information. Stable header/body/footer spacing, aligned actions, and consistent image aspect ratio (4:3 for meals). Use existing real assets and MenuImage fallback; mark illustrations honestly. Meal hierarchy: meal type/date, menu, price/inclusion, booking state, cutoff, action. Plan hierarchy: name, price and period, included meals, dates/terms, action. Never invent discounts, availability, ratings, or “popular” claims. Keep cutoff, skip, guest, approval, and subscription-extension rules exactly as implemented.

### Tables and records

Use semantic table headers/caption when data is tabular; 48–56px default row height, aligned numbers, meaningful status labels and visible row actions. Provide contained horizontal scrolling for truly wide records. A mobile card variant must retain every meaningful field and action with field labels. Do not remove export/download controls, payment references, credits, or balances to simplify appearance. Preserve existing search/filter/sort capabilities; new functionality is outside a cosmetic batch unless separately authorized.

### Modals, drawers and notifications

Dialogs need a heading, accessible name, focused entry point, contained Tab navigation, Escape/close behavior when safe, background inertness, scroll management, and focus restoration. Respect in-flight transaction guards. Mobile dialogs fit dynamic viewport height and scroll internally. Confirm consequences for existing destructive actions without adding needless confirmation steps. Toasts supplement persistent results; errors remain close to the task with role=alert, routine updates use polite status announcements. Avoid announcing every polling update.

### Loading, empty, error and partial states

Use shape-matched skeletons on initial loads with a single accessible loading label and aria-busy on the region; skeleton decoration is aria-hidden. Keep existing content visible during refresh where current state handling allows. Never render loading data as real zero totals. Empty states distinguish no records, filtered-out results, unpublished menu, and no membership; include an existing useful next action. Error states explain the failed task and offer existing retry/navigation. Show partial section failures without representing confirmed payments or unavailable totals incorrectly.

### Icons, photography and illustration

Reuse components/Icon.jsx and its consistent outline style (16/20/24px). Extend the existing icon vocabulary only when needed; no new icon library by default. Decorative icons remain aria-hidden; controls have text or accessible names. Reuse existing food and owner imagery; avoid emoji as a competing primary icon system. Keep operational headers compact with optional small illustration; no large photos behind essential billing or status text. Use alt text for meaningful images, empty alt for decorative repetitions, reserved dimensions and safe object-fit crops.

## Navigation and dashboard composition

Public navigation emphasizes discovery, how joining works, language, and sign-in/owner access. Auth navigation preserves the destination and clearly distinguishes owner/member selection. Product identity and vendor identity have separate typographic levels.

Updated navigation decision: both roles use a compact, non-sticky top header at all viewport widths. Links stay inside the existing accessible Menu dialog, closed by default. Remove the persistent owner sidebar, its independent scrollbar, and its reserved content margin. The dialog uses two columns when space permits and one on phones; short viewports may scroll inside the open dialog so every route remains reachable. Preserve all destinations, query strings, active states, language/account controls, Escape and focus restoration. Navigation closes after route selection.

Owner dashboard order: compact identity, today's meal counts, urgent pending requests/payment confirmations, secondary management shortcuts, setup guidance, then supporting records. Setup guidance remains expanded for incomplete profiles and available as a disclosure for completed profiles. Customer dashboard order: compact current-mess identity/contact disclosure, meal filters and today's meals with open changes first, secondary shortcuts, subscription/payment context, upcoming meals. Keep all meals and existing cutoff/guest/skip guards. The shell shows the existing localized current-page label outside Menu. Avoid repeated large welcome blocks, repeated CTAs, and decorative metric colors that imply nonexistent statuses. Preserve all underlying sections and features.

Chat, mobile navigation, sticky summaries and dialogs must respect safe-area insets and the on-screen keyboard. Chat uses --layer-chat and the shared native Dialog uses --layer-modal. Preserve the token/top-layer relationship and verify actual stacking contexts when adding overlays.

## Motion and accessibility acceptance

Use 120–180ms color/opacity transitions, 180–220ms restrained panel transitions, at most 2–4px movement for intentional overlays. Avoid bouncy cards, large transforms, auto-playing ornament and infinite shimmer. Preserve existing prefers-reduced-motion support and remove nonessential animation under it. Loading progress must remain understandable without motion.

Target WCAG 2.2 AA across keyboard navigation, focus visibility/order, names/roles, contrast, reflow, errors, status announcements, and target sizes. Test at 200% text zoom and 400% browser zoom/reflow, including sticky regions that could obscure focus. Provide a skip link and main landmarks during shared-shell work. Test screen-reader announcements, tabs, menus, dialogs, ratings and file inputs; screenshots alone cannot establish accessibility compliance.

## Historical source audit and priorities

The table below records the original source audit, before the implementation records and follow-up A–E. Its unresolved-risk wording is historical, not a claim about current computed styles. Current rendered evidence and remaining limits are recorded in the linked batch verification reports.

Severity: P1 = task/accessibility risk to prioritize; P2 = consistency/usability issue; P3 = polish. Source findings below describe code evidence, not observed rendered defects.

| Surface | Evidence and finding | Recommendation / validation |
| --- | --- | --- |
| Global styling, P1 | main.jsx layers four global stylesheets; index.css, ui-refresh.css and tiffin-theme.css redefine root colors, buttons, headings, cards and heroes. Component CSS also owns global-looking classes. | Map computed styles first; introduce semantic roles and migrate a component at a time. Check route-to-route styling and load order. |
| Forms/auth, P1 | ui-refresh.css sets input/select/textarea focus-visible outline and box-shadow to none, then removes auth focus shadow and resets its border. Login does already have associated labels, autocomplete and an alert. | Restore a clear focus ring without losing those strengths. Verify actual computed focus across all fields and themes. |
| Cross-app type, P2 | Four imported Latin font families; many 10–11px metadata/eyebrow/nav styles and aggressive heading tracking. No explicit Devanagari font in the inspected theme declarations. | Adopt the bilingual scale; test Hindi marks, mixed text, fallback loading and long labels. |
| Brand, P2 | Login and Navbar say Smart Mess; public theme has a distinctive warm green/cream/food identity. | Unify approved platform copy while preserving owner names; retain the warm identity rather than replacing it with generic dashboard decoration. |
| Public/discovery, P2 | MessDirectory is the actual home; theme defines serif editorial headings, arched thali imagery, small benefit text, two actions on cards. Search, retry, no-results and no-record states already exist. | Preserve the recognizable food direction and useful states; improve text size, action priority and card rhythm. Verify 320px navigation/search and long Hindi names. |
| Mess details/menu, P2 | MessPublic mixes public profile, weekly meals, kitchen, location, reviews and business details. Illustrative thali is explicitly identified. DynamicText and Hindi overrides are present. | Make sections easier to scan, keep meal/date/price/CTA alignment consistent, and preserve illustration disclosure and all business details. |
| Registration/onboarding, P2 | Signup includes role selection, OTP/settings-dependent verification and pending/error states. OwnerOnboarding is a distinct route. | Clarify role and progress visually, keep field grouping and error association consistent; do not change verification gates or redirect handling. |
| Customer dashboard, P2 | CustomerDashboard has a large overview, several CTA links, meal filters/cards, stats, subscriptions, pauses and upcoming meals; initial loading uses text blocks. | Prioritize the next meal and contextual actions; unify loading/empty states and reduce repeated visual emphasis. Preserve refresh/polling and all management actions. |
| Plans, P2 | ChooseFood/MyPlans combine plan dates, included meals, current subscriptions and skip-extension information. | Establish comparable plan cards and persistent readable terms; preserve all displayed rules and amounts. Test long names, no plans, pending purchase and overlapping-date validation. |
| Ordering/payments, P1 | CustomerCheckout, BillWorkflow and PaymentOptions represent manual QR payment and owner confirmation. CustomerCheckout polls activity; Payments distinguishes recorded receipts from collecting money. | Visually separate awaiting payment, proof submitted, awaiting approval and confirmed states using existing statuses. Keep amount/recipient/reference/proof readable; never style upload as success. |
| Owner dashboard, P2 | OwnerDashboard includes setup guidance, large welcome content, operational counts and inline typography; theme colors stat cards by nth-child. | Compact the welcome area, prioritize real operational counts/actions and remove arbitrary status-like color coding. Validate zero, large counts and unavailable data. |
| Owner workspaces/settings, P2 | OwnerWorkspace reuses JoinManager, CustomerDirectory, OfferManager, SubscriptionManager, BillWorkflow and MessProfileEditor. Settings has explicit locked fields/edit controls and Hindi fields. | Reuse feature composition, normalize row/form spacing and communicate locked versus disabled fields. Keep approval, plan assignment, billing and save boundaries intact. |
| Navigation/mobile, P1 | Navbar has ten owner links/eight customer links. ui-refresh.css wraps nav below 1350px with overflow-x:auto and hides its scrollbar; more owner rules exist in index.css. | Verify discoverability and Hindi width in browser; propose a labeled responsive shell keeping every link and active state. No route changes. |
| Dialog/chat, P1 | CustomerDashboard guest dialog has dialog semantics and autofocus; its visible implementation lacks a complete focus-trap/Escape/restore pattern. Chat CSS has a higher z-index than modal backdrop. | Audit keyboard/background interaction and overlay stacking; implement one reusable dialog presentation preserving submission guards. |
| Loading/errors, P2 | Several pages use loading-card or paragraphs; some existing errors use role=alert and messages use role=status. Customer dashboard can render multiple loading blocks. | Standardize region-level busy, empty, error and refresh presentation; retain section-level error specificity and do not announce every poll. |
| Motion, P3 | ui-refresh.css adds card/button movement and includes a comprehensive reduced-motion rule; index.css also has reduced-motion handling. | Retain reduced-motion behavior while simplifying motion; do not claim reduced-motion support is absent. |
| Admin, unverified | No implemented admin surface found. | Confirm whether it lives in another project before planning actual files or changes. No new admin features in this scope. |

Review coverage includes forms, bills/history, reviews, pauses, mess selection, owner profile/menu editing, kitchen advisor and global chat through their route/component inventory and shared style contracts. These secondary surfaces still require a full rendered state walkthrough before making page-specific visual claims.

## Implementation batches (after approval)

All paths below are repository-relative. Proposed new shared files are suggestions, not permission to scaffold now. Keep each batch independently reviewable; capture representative before/after screenshots when implementation is authorized. Record failures present before the batch separately from regressions.

| Batch | Affected files | Expected improvement | Risks | Required verification |
| --- | --- | --- | --- | --- |
| 1. Tokens, fonts, global styling | frontend/src/index.css, ui-refresh.css, tiffin-theme.css, main.jsx; owner-tab-backgrounds.css only for conflicting token use; optional frontend/src/styles/tokens.css | One semantic palette, bilingual type, clear focus, predictable spacing/radii | Cascade changes affect every route; remote font fallback; legacy specificity | Inventory computed styles; public/auth/customer/owner screenshots in English/Hindi; font fallback, contrast, build and lint baseline |
| 2. Shared components/navigation | components/Navbar.jsx, Icon.jsx, LanguageProvider.jsx presentation, ChatWidget.jsx; relevant existing CSS; optional shared Button, Field, Card, StatusBadge, Dialog, PageHeader components | Consistent controls, clear route hierarchy, responsive navigation and safe overlays | Hidden destinations, focus regressions, chat overlap, accidental behavior changes | Every link/query/hash/active state; keyboard open/close/restore; logout and language regression; modal/chat overlap; targeted component tests |
| 3. Public website | pages/MessDirectory.jsx, mess-directory.css, MessPublic.jsx, mess-public.css, Explore.jsx, components/Discovery.jsx, discovery.css, PublicReviews.jsx, MenuImage.jsx; Login.jsx, Signup.jsx, SignupOtp.jsx and auth CSS as a bounded sub-batch | Warm editorial discovery, trustworthy detail pages, readable auth and join entry | Confusing actual vs illustrative imagery; return destination and OTP regressions; long text | Public search/loading/empty/error; detail anchors and join handoff; owner/customer auth and OTP states with approved test data; 320px/Hindi captures |
| 4. Customer pages | CustomerDashboard.jsx, CustomerMesses.jsx/customer-messes.css, JoinMess.jsx, CustomerAddress.jsx, ChooseFood.jsx, CustomerCheckout.jsx, MyPlans.jsx, CustomerPause.jsx, MealHistory.jsx, BillHistory.jsx, Reviews.jsx; customerJourney.css and related BillWorkflow/PaymentOptions/PersonalOrders/receipt components | Clear next meal, comparable plans, understandable payment and membership stages | Amount/status misrepresentation; date/cutoff/skip/guest logic; multi-mess context | Existing route/gate behavior; purchase/payment pending/confirmed/rejected states; plan and meal selection, dates, receipt/download, guest modal, refresh focus; relevant existing tests |
| 5. Owner dashboard | OwnerDashboard.jsx, OwnerWorkspace.jsx, OwnerOnboarding.jsx/owner-onboarding.css, ManageMeals.jsx, OwnerReviews.jsx, OwnerPublicPage.jsx, Payments.jsx/payments.css, KitchenAdvisor.jsx/kitchen-advisor.css; CustomerDirectory, WeeklyMenuEditor/weekly-menu.css, JoinManager, OfferManager, SubscriptionManager, MessProfileEditor, MenuPhotoEditor and owner CSS | Compact operational hierarchy, readable editable menus, uniform member/billing/settings records | Losing dense actions; changing approval/save/payment semantics; image backgrounds obscuring text | Large/empty member lists; weekly menu editor tests; requests, assignments, settings locked/edit/Hindi fields, payments/receipts, image preview, onboarding and advisor; keyboard and phone walkthrough |
| 6. Admin dashboard (conditional) | No current files identified; confirm actual repository/route first | Apply the same system to an existing admin surface if located | Inventing scope or assuming owner is admin | Document location and access model before implementation; if absent mark batch not applicable and create no route |
| 7. Responsive/accessibility | Styles and components touched in batches 1–5; global navigation, dialogs, tables, chat, language toolbar, review/file controls | Reliable touch, reflow, keyboard access, readable bilingual content | CSS fixes leaking into other routes; sticky controls hiding focus | 320/375/390/640/768/1024/1280/1440px, representative portrait/landscape; 200% text and 400% zoom; touch targets; keyboard and screen reader; contrast and both language states |
| 8. Final polish/testing | Only affected frontend files and their justified existing/targeted tests; i18n/hi.js and extraHindi.js only for approved changed UI copy | Consistent visual rhythm, imagery, transitions and all states | Scope creep, brittle screenshot assertions, untranslated copy | Production build, lint, translation checks, existing relevant Vitest/Node tests; route/state screenshot matrix, slow/error states, reduced motion, fonts/images failing; verify no API/business/auth diff |

Dependencies: 1 precedes 2; 3–5 follow shared foundations; accessibility is checked in every batch and consolidated in 7; 8 closes the agreed scope. Admin and full dark-mode release remain conditional rather than excuses to broaden the redesign.

## Test and review protocol

From frontend, established commands include npm run build, npm run lint, npm run test:language, npm run check:translations and npm run test:language-ui. Use the installed Vitest runner for relevant existing tests such as CustomerMesses, WeeklyMenuEditor and Messages; inspect test configuration before selecting command arguments. Do not claim all checks pass without executing them. Documentation-only work does not require an application build or installation.

For each changed surface test initial load, populated, genuinely empty, filtered-empty, failed, partially available, disabled, saving and success states where applicable. Use existing approved local/demo data; do not submit real payments, alter live memberships, or manufacture dashboard numbers to make screenshots attractive. Capture representative public/auth/customer/owner states at matched viewport sizes in English and Hindi. Validate actual navigation and keyboard behavior as well as appearance. Add focused behavior tests only for meaningful changes such as dialog focus or navigation disclosure; avoid tests that merely assert CSS implementation.

Completion means all existing functionality remains reachable, no unexplained behavior/API diff, no lost translations, no essential content clipped, consistent design tokens, verified focus/contrast/reflow, appropriate test results recorded, and limitations disclosed. Obtain approval for the redesign before starting batch 1; later work follows the user's authorized scope without repeated blanket approval requests.


## Approved implementation records — 16 October 2026

Batch 3 refreshes the routed public directory, mess details, discovery, reviews, join entry and authentication presentation. Public pages retain the thali identity, illustrative-image disclosures, search, menu anchors, join destinations and OTP behavior. AuthLayout centralizes the repeated sign-in/registration presentation; forms appear before supporting imagery on phones. Evidence, exact file inventory and limitations: [Batch 3 verification](output/batch3-ui/verification.md).

Batch 4 uses CustomerPage as a scoped presentation boundary for all ten customer page modules (including meal and plan browsing routes). The existing customerJourney.css owns these styles; no additional global theme layer or UI dependency was introduced. Customer headers use plain surfaces and compact task hierarchy, meals use consistent 4:3 images and aligned actions, operational metrics use neutral surfaces, records wrap at phone widths and forms retain native controls. Checkout renders the existing BillWorkflow outside the summary header, with identical props and status conditions. Shared payment/owner handlers, billing/date calculations and polling are unchanged. Owner feedback row styles retain their previous appearance. Evidence, exact file inventory and limitations: [Batch 4 verification](output/batch4-ui/verification.md).

These are incremental light-theme changes. Screen-reader verification, actual 200% text zoom/400% browser zoom and comprehensive contrast measurements are still outstanding; responsive screenshots and automated tests do not establish WCAG compliance.


### Batch 5 — owner workspace

OwnerPage provides a scoped presentation boundary across the existing dashboard, workspaces, meals, onboarding, payments, reviews and advisor routes. The former owner-tab-backgrounds.css now owns the owner layout foundation and replaces its image-background rules; no new global theme layer or dependency was added. Existing owner images remain in the repository. Headers use plain surfaces, numeric cards use neutral styling, fields/rows have readable bilingual type, and weekly menus have a named keyboard-focusable scroll region. The completed-profile setup guide is a native disclosure; incomplete setup remains expanded. Current meal statistics precede the request summary. The owner personal-order notification uses the shared Dialog, preserving its paid-order eligibility and acceptance handler, with dismissal/focus handling and an in-flight close guard. CustomerDirectory now translates its existing status, meal types and missing-address fallback. No API, financial/date rules, authentication, save boundaries, polling, routes or redirects changed.

Exact files, checks, screenshots and remaining limitations are recorded in [Batch 5 verification](output/batch5-ui/verification.md). Batch 6 remains conditional: there is still no routed admin dashboard; none was created. Subsequent batch records appear below.


### Batch 6 applicability and Batch 7 — responsive/accessibility

The user authorized the next batch after Batch 5. App.jsx still has no admin route or admin page, so conditional Batch 6 is not applicable; the next applicable batch was Batch 7. No admin interface was created.

Batch 7 adds public/auth skip access alongside the existing workspace skip link, independent native rating groups with Hindi accessible names, stronger rating/photo/input focus contrast, larger photo controls, workspace end spacing clear of chat, and short-viewport chat layout. Automatic message scrolling is contained to the conversation log, preserving message requests, send/retry/read logic and polling. Chat's duplicate owner thread header is hidden only in short viewports where the member selector already identifies the conversation; its close control, member selector, message log and composer remain available. Dialog text and controls wrap within their viewport bounds.

[Batch 7 verification](output/batch7-ui/verification.md) records the exact files, tests, keyboard/geometry evidence and limitations. The available browser tooling does not expose browser zoom, text-only zoom, screen-reader control or reduced-motion emulation. Narrow-width reflow checks are not a substitute for those outstanding checks and do not establish WCAG compliance. Batch 8 is recorded below.


### Batch 8 — final polish and testing

Completed the final regression pass. MenuImage now falls back from failed remote images to the existing labeled illustration, then to the existing empty-photo state if needed. A new supplied URL remains eligible to render. Requests, image selection rules, routes and business logic are unchanged. Added three focused image-failure tests. Updated the two stale language-test assertions to use the actual menu label and owner copy; strengthened the menu test to verify Hindi labels and preserved text after returning to English. Final explicit UI suite: 57 passed, zero failed. Node language/service suite: 26 passed. Lint, static translation coverage and production build passed. The existing large-bundle build warning remains.

Final files, test commands, visual evidence and limits: [Batch 8 verification and completion report](output/batch8-ui/verification.md).

| Batch | Final status |
| --- | --- |
| 1. Tokens, fonts and global styling | Implementation complete |
| 2. Shared components and navigation | Implementation complete |
| 3. Public website and bounded authentication presentation | Implementation complete |
| 4. Customer pages | Implementation complete |
| 5. Owner workspace | Implementation complete |
| 6. Admin dashboard | Not applicable; no route exists and none was invented |
| 7. Responsive/accessibility improvements | Implementation complete; manual zoom/screen-reader verification remains outstanding |
| 8. Final visual polish and regression testing | Complete within available tools; no deployment performed |

This records completed implementation, not certification of production readiness or WCAG compliance. Screen-reader testing, actual 200% text/400% browser zoom, physical virtual-keyboard behavior and exhaustive states remain unverified as documented. Full dark-mode release was not part of the approved light-theme rollout.

### Follow-up Batch A — task-first dashboards

Following the rendered audit and approval, dashboard introductions and shortcuts are compact, customer meals with open changes appear first, and owner current counts and pending requests precede supporting management. Existing localized page-location text is now visible in the shared shell; Menu remains the approved primary navigation model. Meal cards retain food imagery, and the green/amber palette and pastel task cues remain. All requests, guards, amounts, polling and destinations are preserved. [Batch A verification](output/batch-a-ui/verification.md) records before/after evidence, 35 passing UI tests, 7 passing language tests, build/lint/translation checks and outstanding manual verification. Follow-up B–E are recorded below.


### Follow-up B–E — journeys, browsing, discovery and owner records

Completed the approved remaining audit batches. Future payment is informational until checkout exists; approved-member handoffs retain their selected meal and use continuation copy. Catalogs have bounded initial dates, real filters/reset/full-date access and read-only error recovery. Plans have explicit date recovery and aligned comparison, with locale-aware displayed dates. Public discovery leads with search; scoped routed branding is Smart Mess; password visibility and photo disclosures are explicit. Owner records are grouped, payment reviews precede QR configuration and publishing/assignment anchors preserve the underlying forms. No auth/membership-write/checkout handler, financial rule, endpoint or polling change was made. Filters, date helper and catalog retry are intentional UI behavior additions.

[B–E verification and completion report](output/batches-b-e-ui/verification.md) includes before/after captures, source inventory, 68 passing UI tests, 26 passing Node tests, successful lint/build/translation coverage and manual-verification limits. No deployment or real transaction was performed. This is implementation completion, not WCAG or production-readiness certification.


## Swiggy reference refresh — 16 October 2026

The user requested UI improvements using https://www.swiggy.com/ as a reference. The live homepage was inspected in the browser: a high-contrast hero, centered search, food imagery framing the task and large service destination cards. Adapt these patterns to Smart Mess with the approved green/amber identity and existing bundled imagery. Keep the Smart Mess name. Do not import Swiggy assets, fabricate discounts, ratings, delivery promises or new service flows.

Implemented on the routed MessDirectory homepage: a centered green hero, white search surface, amber heading accent, decorative food edges, three food-led destination cards, and simpler kitchen cards with prominent photos. Destination cards point to discovery, the existing how-it-works section and the existing role-appropriate account route. Small screens stack cards, reduce decorative imagery and preserve natural Hindi wrapping. Existing search, city chips, retries, empty states and view/join links are retained. Scope is the public homepage; authenticated operational layouts retain their earlier approved design.

Verification: lint, translation coverage, 19 existing public/language UI tests and production build passed. Browser checks covered English desktop/phone/tablet, Hindi at narrow phone width, actual city filtering/reset, no-match results, Enter submission/results focus and visible keyboard focus. Screenshots and limits: output/swiggy-reference-ui/verification.md. Existing bundle-size warning remains.


## Corporate reference extension — 16 October 2026

The user additionally requested https://www.swiggy.com/corporate/ as a reference for the public kitchen page and owner/member dashboards. The live reference was inspected visually: light lavender surfaces, bold sans-serif headings, rounded media and spacious section boundaries. Adapt its presentation to Smart Mess without importing its content, assets or corporate navigation.

MessPublic now uses a mint-to-lilac hero with bold headings and a framed illustrative meal image, a tinted address/timing/contact strip and a lilac kitchen story section. Existing menus, reviews, business details and join/account links remain. OwnerDashboard and CustomerDashboard use compact matching header surfaces with decorative existing icons; decorative marks hide on phones. Operational content retains its order, current-meal counts, requests, filters, action guards, forms and refresh intervals. Summary panels use distinct pastel surfaces and persistent labels; shortcut cards use white surfaces, tinted icons and visible desktop direction arrows. Customer summary styles are limited to the member dashboard. No backend, route, data, payment or transaction behavior was added by this extension.

Verification and before/after screenshots: output/corporate-reference-ui/verification.md. Lint, translation coverage, 32 focused UI tests and build passed. Browser samples include English desktop/phone, Hindi phone for all three pages, member 320px/768px reflow, filter reset and keyboard disclosure. Manual limits remain documented; this does not certify full accessibility compliance.


## Owner preparation cards — 16 October 2026

Approved screenshot-specific refinement: preparation cards have separate meal/date headers, menu headings, cutoff status/time, aligned expected totals and a consistent two-column count breakdown. Native CSS subgrid aligns corresponding rows across each desktop/tablet card row without truncating long menus or Hindi. Personal orders retains its existing scroll destination and now has an arrow and separately stacked count; its accessible name uses translated label/count. Dates and cutoff display use the active locale. Preserve the original headcount values, composition calculation, day filters and polling. At 320px, smaller tile padding and 13px supporting labels prevent awkward word splitting. Evidence and limits: output/headcount-cards-ui/verification.md.


Owner preparation disclosure follow-up: show only today's preparation cards by default, using the existing today's-menu label. Show more reveals the next two days and the existing day filters; Show less restores today's cards and resets the expanded filter. Keep the toggle keyboard-operable with aria-expanded/aria-controls. The collapsed empty state refers specifically to today. No API/polling/count changes. Verified live 3 today cards → 9 across three days → 3 tomorrow cards through the filter → 3 today cards on collapse. Regression test added to OwnerExperience.test.jsx; initial failure confirmed future cards were present before implementation, then all four owner tests passed.


Minimal owner preparation cards (user follow-up): use plain meal labels, 16px menu headings, 36px totals, a 3px composition line and unboxed two-column metrics. Keep 20px card padding, 16px radius, aligned subgrid rows, readable supporting labels and a minimum 44px orders-link target. This replaces the previous tinted metric-tile treatment for these cards only. Retain today-only disclosure and all counts/actions. Live desktop card height measured 370px versus approximately 500px in the preceding capture; Hindi 320px view inspected without horizontal overflow. Evidence: output/headcount-cards-ui/minimal-after.png and minimal-phone-hi.png.
