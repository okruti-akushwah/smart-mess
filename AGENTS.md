# Repository guidance

## UI and UX work

- Read [DESIGN.md](DESIGN.md) before changing frontend presentation. It defines the proposed Smart Mess brand, tokens, bilingual typography, component rules, source audit, and phased redesign plan.
- Use [.agents/skills/ui-design/SKILL.md](.agents/skills/ui-design/SKILL.md) for UI implementation, UI reviews, responsive work, and accessibility testing. Keep implementation consistent across the affected public, customer, and owner surfaces.
- The user approved completion of all applicable redesign batches (1–5, 7 and 8). Batch 6 is not applicable because no admin dashboard is routed. The implementation is complete with verification limits recorded in DESIGN.md and output/batch8-ui/verification.md. Retain the green/amber palette. Implement only the authorized batches; this is not a requirement to ask before routine edits within an approved batch.
- Preserve authentication, role/membership/address gates, routes and redirects, query strings, APIs, business rules, financial calculations, polling, and all existing functionality. Do not create an admin dashboard merely because one was mentioned in the plan; none is currently routed.
- Preserve English and Hindi support, useTranslation/DynamicText conventions, explicit Hindi content fields, language persistence, and locale-aware presentation. Review both languages, long names, mixed-script text, and Devanagari rendering.
- Reuse existing components, Icon, MenuImage, assets, and custom CSS. Do not rewrite the app or install a UI library without a concrete need and user-authorized scope.
- Inspect main.jsx stylesheet order and feature CSS consumers before editing global selectors. Migrate repeated styling incrementally; do not add another overriding theme layer as a shortcut.
- Inspect git status before work. Preserve unrelated uncommitted changes, including existing frontend edits. Do not reset, overwrite, commit, deploy, or clean up unrelated files as part of visual work.
- Verify the actual App.jsx route rather than assuming a similarly named page is active. The homepage is MessDirectory, not Home.
- Separate source findings from verified browser observations. Never claim screenshots, responsive behavior, accessibility compliance, or passing tests without evidence.
- Run checks proportional to the change using frontend/package.json and existing tests. Document baseline failures separately. For UI changes, include keyboard, phone/desktop, English/Hindi, loading/empty/error/disabled checks and meaningful before/after visual review.

## Maintaining design instructions

Keep DESIGN.md authoritative for visual decisions and the UI skill authoritative for the repeatable workflow. Update approved decisions in place rather than introducing competing specifications. Preserve any future unrelated repository guidance when extending this file.

## Approved bright visual refresh

The user requested a brighter, more interactive experience with light colors, imagery, icons and clear flows after the original batches. Follow the updated DESIGN.md: green anchor, pastel task surfaces, labeled illustrative food imagery, real route shortcuts and an accessible meal journey. Preserve existing gates and transaction behavior.
