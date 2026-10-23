# Nearby Messes Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Find kitchens within 4 km or 10 km.
**Architecture:** Optional public kitchen coordinates; backend Haversine filtering; browser geolocation held in memory.
**Tech Stack:** FastAPI, SQLAlchemy, React, existing CSS and localization.
**Spec:** ../specs/2026-10-17-nearby-messes-design.md

## Global Constraints
Preserve unrelated working-tree changes, public routes and membership gates. No new dependencies, deployment or commits. Keep English/Hindi and green/amber presentation.

## Review Focus
- Zero coordinates are valid; incomplete pairs fail.
- Old profile clients preserve saved coordinates.
- Distance rounding cannot admit an outside-radius kitchen.
- A late geolocation/API result cannot restore a cleared search.
- Permission denial preserves usable directory results.

### Task 1: Profile and radius API
Files: backend/test_nearby.py, app/models.py, app/migrations.py, app/migrate.py, app/routes/profile_routes.py, app/locations.py.
Interfaces: profile latitude/longitude nullable floats; GET /public/messes accepts latitude, longitude, radius_km and returns additive distance_km.
- [x] Add API tests for validation, omitted/cleared location, distances, sort, unknown locations, and backward compatibility.
- [x] Run `.runtime/Scripts/python.exe -m unittest test_nearby` from backend; expect feature assertions to fail.
- [x] Implement coordinates, migration revision and distance API.
- [x] Repeat test command; expect all passing. Run existing public profile and migration tests.

### Task 2: Location controls and discovery
Files: frontend/src/components/KitchenLocation.jsx, services/geolocation.js, pages/MessDirectory.jsx, components/MessProfileEditor.jsx, affected CSS, i18n/extraHindi.js, focused UI tests.
Interfaces: controlled kitchen coordinate draft; geolocation helper resolves latitude/longitude/accuracy; directory composes search and radius.
- [x] Add UI tests for location permission, reset and radius filtering interactions, then run Vitest and observe feature failure.
- [x] Implement reusable location controls, owner draft/save integration, and directory filtering/loading/error handling.
- [x] Run tests, build, lint and translation checks; inspect phone/desktop English/Hindi where browser runtime permits.

### Task 3: Review and testing instructions
- [x] Review diff against spec, run regression checks, record actual results and manual nearby test steps in output/nearby-extras/verification.md.

## Execution record
User approved specifications and explicitly requested implementation in this session. Work remains in the current checkout because approved UI work exists only as uncommitted changes; an isolated worktree would omit it. Native execution; no commits or deployment.
