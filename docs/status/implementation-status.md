# Implementation Status

Update this through real PRs. Do not backdate progress.

## Current phase
Moderation lifecycle and database foundation

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
- [x] moderator route guard and placeholder
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
- [ ] community actions
- [ ] abuse flagging and evidence evaluation
- [ ] moderation cases and queue APIs
- [ ] moderation

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
