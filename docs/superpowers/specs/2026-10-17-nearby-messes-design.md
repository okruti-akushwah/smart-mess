# Nearby mess discovery

Date: 17 October 2026. Status: user-approved and implemented locally; verification limits are recorded in output/nearby-extras/verification.md.

## Intent and scope

Implement request 1: find messes within 4 km or 10 km. Request 3, the dashboard menu redesign, is excluded. Preserve the existing directory, public links, membership requests, authentication, address gates, and English/Hindi support. Existing uncommitted work must be retained.

## Approach

Use owner-saved kitchen coordinates and browser geolocation with server-calculated Haversine distance. This supports the requested radius without a map SDK, geocoder subscription, or routing service. Distances are approximate straight-line distances, not driving distances or delivery promises. An external map/address-search integration can be considered separately if needed.

## Owner location

Add nullable latitude and longitude to MessProfile through the existing migration runner. Validate finite numbers, latitude -90 to 90 and longitude -180 to 180; accept a complete pair or neither. Zero is valid. Reject partial pairs.

Extend the existing public profile editor with a location group: Use current location, editable latitude/longitude, Clear location, and an explanation that the saved position must be the kitchen. Geolocation fills the draft only; the existing Save action persists it. Show accuracy when available and allow correction before saving. Handle permission denial, timeout, unsupported geolocation, and failed saves without losing the draft. Preserve coordinates when older profile clients omit both fields; explicit nulls clear them.

Coordinates describe the public business location. Do not persist customer search coordinates, add location tracking, or infer coordinates from city names.

## Directory contract and behavior

Extend GET /public/messes with optional latitude, longitude, and radius_km (4 or 10). Coordinates must appear together; radius requires coordinates. No query parameters retains the existing directory behavior and response array.

With coordinates supplied, return distance_km for located messes, sort nearest first with a stable secondary ordering, and apply the radius using full precision before display rounding. Unknown locations cannot qualify for a radius. Without a radius, retain unlocated results after located results. Additive response fields must not break existing directory consumers. Continue using the existing directory visibility rules and invitation links.

On the routed MessDirectory homepage, add Use my location and All distances / Within 4 km / Within 10 km controls beside existing search. Do not request permission on page load. The default remains All distances. Radius selection requests a location if none is available; denied or unavailable location leaves the current valid results and offers retry. Name/city/area search composes with the distance filter. Clearing location resets the radius and removes location from requests.

Show rounded locale-aware distance only when known, label it approximate, and explain that kitchens without saved locations are excluded from radius results. Empty-radius results offer 10 km or All distances. Retain loading, API retry, filtered-empty, and directory-empty distinctions. Abort or ignore stale requests so late results cannot replace a newer filter selection. Search coordinates live only in component memory and are not placed in a shareable browser URL.

## Files and verification

Backend: models.py, migrations.py, routes/profile_routes.py, plus focused location/directory tests. Frontend: MessProfileEditor.jsx, MessDirectory.jsx and affected feature CSS; reuse a small geolocation helper if both controls need it. Add English/Hindi resources using current conventions. DESIGN.md remains authoritative for presentation; this specification defines feature behavior only.

Test zero/invalid/partial coordinates, omitted-versus-cleared profile updates, exact radius boundaries, stable sorting, unknown locations, default backward compatibility, and unchanged join links. Frontend checks cover geolocation success/denial/timeout, stale responses, composed search, reset, empty/error/loading states, keyboard operation, and bilingual labels.

Run relevant existing profile/directory tests, frontend build/lint and translation checks. Review actual phone and desktop renders in both languages where the local runtime permits; record unavailable checks rather than claim them. No production database changes, deployment, or unrelated commits are part of this review stage.
