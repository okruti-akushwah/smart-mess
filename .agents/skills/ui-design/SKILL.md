---
name: ui-design
description: Implement and review Smart Mess frontend presentation with its design system, bilingual layouts, responsive behavior, and accessibility checks. Use for UI changes and UI quality reviews; exclude backend-only work and business-logic changes.
---

# Smart Mess UI workflow

## Start with scope and evidence

1. Read the repository [AGENTS.md](../../../AGENTS.md) and [DESIGN.md](../../../DESIGN.md). Confirm the user's current scope. During the initial design-documentation phase, edit only the three authorized Markdown files and wait for approval before implementation. Later approval permits the agreed batches without repeated blanket confirmation.
2. Inspect git status and preserve all unrelated edits. Trace the target through frontend/src/App.jsx, its page, reused components, localization, and active CSS imports. Do not infer a route from a filename or invent an absent admin interface.
3. For a rendered UI review, capture and inspect the real before state at representative phone and desktop widths with the relevant role and language. Use existing approved local/demo data. If a runtime, credentials, or valid state is unavailable, continue source analysis where useful and explicitly identify unverified visual/interaction claims. Do not present source inspection as screenshot evidence.
4. Define the user task, existing actions/states that must remain, affected files, and a small reviewable batch. Read the actual request/status/validation handling before changing its presentation.

## Implement incrementally

5. Use semantic colors, spacing, type, radii, shadows, and state rules from DESIGN.md. Inspect computed styles and main.jsx import order before resolving cascade conflicts. Consolidate the affected rule where practical rather than adding broad overrides or a new theme stylesheet.
6. Reuse Navbar, Icon, MenuImage, DynamicText, BillWorkflow, payment and menu components. Extract a shared presentation primitive only when it solves repeated concrete needs. Keep request handlers, route/gate behavior, data shape, financial/date calculations, polling and action guards intact.
7. Build all applicable states together: default, hover, focus, active, disabled, pending, loaded, empty, filtered-empty, error, partial failure and success. Keep consequential payment/membership states distinct; proof uploaded is not payment confirmed. Preserve every existing field/action and the explanation of meal cutoffs, guest limits, skips and plan extensions.
8. Keep labels and helpers readable, controls accessible by keyboard, and dialogs correctly named with focus containment/restoration and safe close behavior. Keep chat and sticky navigation below modal interactions and clear of mobile keyboards/safe areas. Honor reduced motion.
9. Preserve translation conventions and explicit Hindi overrides. Add resources only for approved changed copy, retaining English fallback and language persistence. Use natural-height wrapping, proper Devanagari fonts/line height, and locale-aware displayed dates/prices without changing stored values. Avoid status meaning carried by color alone.

## Review and verify

10. Compare actual before/after renders at the same viewport, route, role, language and data state. Check hierarchy, spacing, type, crop, table readability, consistent action priority and all retained functionality. Fix the affected batch before expanding scope.
    Check task visibility: a dashboard's next meal/current count should begin in the first phone screen, and current owner counts plus urgent requests should fit in the first tablet/desktop screen with representative data. Compact introductions and secondary shortcuts before reducing important content or text sizes. Preserve explicit setup guidance and every retained record/action.
    Check journey labels against their actual destinations and states. Future payment is informational until a real checkout exists; a payment link must retain its bill query. Membership handoffs retain the meal hash and distinguish approved, pending and unjoined accounts. Verify filter reset, access to all dates and an explicit date-recovery action without silently changing a user's choice.
11. Verify phone 320–390px, tablet 768px, and desktop 1280–1440px, plus the changed component's breakpoint edges. Check both languages, long mixed-script names, large values, empty and failed content, slow loads and missing images/fonts. Test 200% text zoom and 400% reflow; allow horizontal scrolling only inside intentional wide-content regions.
12. Verify keyboard reachability/order, visible focus, localized accessible names, labels/errors, non-color state cues, dialog/menu behavior, status announcements and contrast. Use available browser/accessibility tools and a screen reader for changed complex interactions. Record limitations; automated checks or screenshots alone do not establish WCAG compliance.
13. Inspect frontend/package.json for current commands. Run build/lint and translation checks when applicable; run relevant existing tests and add focused tests only for meaningful behavior changes such as disclosure or modal keyboard behavior. Separate pre-existing failures from regressions. Documentation-only changes require link/content/scope validation, not dependency installation or a build.
14. Review the final diff for API, authentication, business-rule, translation and unrelated changes. Report changed files, visible outcome, checks actually performed, remaining risks and unavailable verification. Do not claim production readiness from an unrendered source review.

## Completion criteria

The batch follows the approved design direction, preserves existing features and behavior, remains usable in English and Hindi across screen sizes, has no known new keyboard/focus/contrast blockers, and has evidence appropriate to its scope. Keep DESIGN.md synchronized with approved decisions. Stop at the authorized boundary; do not deploy, submit live transactions, or expand into new product functionality as part of cosmetic work.
