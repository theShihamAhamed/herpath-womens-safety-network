# Implementation Status

Update this through real PRs. Do not backdate progress.

## Current phase
Moderation governance system

## Repository
- [x] frontend structure
- [x] backend structure
- [x] docs baseline
- [x] CI
- [ ] develop branch

## Backend foundation
- [x] environment validation
- [x] database connection
- [x] health endpoint
- [x] errors / 404
- [x] logging
- [x] rate limiting

## Authentication
- [x] anonymous session
- [x] registration
- [x] login
- [x] refresh/session restoration
- [x] logout
- [x] `/auth/me`
- [x] role authorization
- [x] moderator provisioning
- [x] secure native storage

## Mobile shell
- [x] anonymous-first startup and session restoration
- [x] sign-in and sign-up screens
- [x] three-tab navigation shell: Map, Report, Profile
- [x] Map home UX shell and Routing public integration boundary
- [x] nested Safety Updates route and accessible Map entry
- [x] profile/auth-state placeholder
- [x] role-protected moderator dashboard with queue, case review, workflow actions, decisions, and audit history
- [x] recoverable startup error state

## UX baseline
- [x] information architecture and screen-planning baseline
- [x] content, accessibility, alerts, integration, and usability guidance
- [x] ADR-004 primary-navigation decision

## Components
### Shiham
- [x] privacy-aware incident persistence and H3 resolution-8 public projection
- [x] authenticated exact-private and approximate-only submission
- [x] owner-scoped idempotency, new-report rate limiting, and My Reports API
- [x] consolidated three-stage mobile report flow with direct Review editing and owner history
- [x] contextual Incident privacy guidance and accessible draggable privacy sheet
- [x] public Incident reader integrated with Map endpoints
- [x] independent visibility, community evidence, and moderation workflow state foundation
- [x] lifecycle compatibility projection and legacy public-read fallback
- [x] aggregate-only lifecycle dry-run, idempotent backfill, and restricted rollback
- [x] actor-private community feedback persistence and replacement history
- [x] deterministic evidence evaluation, current support count, and ageing
- [x] authenticated feedback, verification status, and eligibility APIs
- [x] aggregate-only evidence reconciliation dry-run/apply command
- [x] immutable abuse flags with actor-scoped idempotency, duplicate prevention, and rate limiting
- [x] moderation cases with priority ordering and conflict/flag intake
- [x] moderator queue, detail, claim, release, and reopen workflow APIs
- [x] audited moderator decisions: no action, hide, restore, archive, and archive duplicate
- [x] append-only audit history with privacy-safe moderator projections
- [x] conflicted-evidence moderation intake dry-run/apply command
- [x] authorization, privacy, concurrency, idempotency, and transaction rollback hardening

### Naji
- [x] map shell
- [x] markers/filters
- [x] area summary
- [x] incident repository/public projection integration
- [x] approximate public-area polygon rendering
- [x] refresh Map after successful report return


### Sandaruwan
- [x] destination search and geocoding integration
- [x] selected destination display and coordinates handoff to route planning
- [ ] provider route alternatives
- [ ] risk comparison

### Eshan
- [ ] journey state machine
- [ ] tracking
- [ ] arrival/outcome
- [ ] analytics

## Baseline change log
`YYYY-MM-DD | PR # | Change | Reason`

## Phase 3 backend validation

- [x] authorization matrix tests
- [x] moderation response privacy-leakage tests
- [x] concurrent claim and decision tests
- [x] moderator action idempotency tests
- [x] transaction rollback tests
- [x] Community Verification preservation tests
- [x] public visibility regression tests
- [x] backend tests passing (26 files, 193 tests)
- [x] backend typecheck passing
- [x] backend lint passing
- [x] backend build passing
