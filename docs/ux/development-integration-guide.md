# HerPath UX Development Integration Guide

## Shared foundation

Major feature development builds on this primary navigation:

```text
Map | Report | Profile
```

Routing appears inside Map UX but remains technically independent.

## Map ownership — Naji

Map owns the screen/container, map surface and camera, current-location presentation, incident markers/clusters, filters, area summaries, visible-area report alternatives, and the integration container that hosts Routing UI.

Primary directories:

```text
frontend/src/features/map
backend/src/modules/map
```

## Routing ownership — Sandaruwan

Routing owns origin/destination state, place search, candidate retrieval, route-risk evaluation, comparison/explanation, selection, and Journey handoff.

Primary directories:

```text
frontend/src/features/routing
backend/src/modules/routes
```

Routing exposes public components, hooks, and types from its feature boundary. Map imports those public exports and must not import Routing internals. Routing should not repeatedly rewrite Map internals.

## Incident/Moderation — Shiham

Incident owns report capture, authenticated ownership, exact-private storage, approximate-only area selection, H3 conversion, persistence, idempotency, owner history, and the explicit public projection. Map consumes only the Incident-owned public reader and generic `publicLocation`/`publicArea` GeoJSON contract; it does not import the Incident model or repository. Map owns approximate-area rendering, refresh behavior, clustering, heatmaps, and callout presentation. Backend moderation governance is implemented, including abuse flagging, moderation cases, moderator workflow APIs, and audited moderation decisions. The role-protected moderator dashboard frontend is implemented with queue filtering, case review, workflow actions, visibility decisions, and privacy-safe audit history. Future enhancements may add reporter communication, moderation analytics, and richer case-discovery tooling without weakening the existing authorization, privacy, revision, or audit boundaries.

## Journey — Eshan

Journey may begin with a documented selected-route mock contract, then replace it with Routing's stable handoff. It owns consent, active tracking, check-ins, arrival, explicit outcomes, and journey analytics.

## Shared files

Coordinate significant changes to:

```text
frontend/app/_layout.tsx
frontend/app/(tabs)/_layout.tsx
frontend/src/components/
frontend/src/theme.ts
frontend/src/services/api/
frontend/src/config/
backend/src/app.ts
backend/src/common/
docs/
.github/
```

## Documentation rule

A PR that changes API contracts, navigation, shared data shapes, ownership, privacy rules, route/journey state, alert behavior, accessibility behavior, or safety terminology updates the related documentation in the same PR.

## UX definition of done

Confirm that a first-time user can find the primary action; loading/error/empty and denied-permission states recover; text can scale; important information is not color-only; controls are comfortable; safety wording avoids guarantees; and the next action is understandable.
