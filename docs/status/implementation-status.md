# Implementation Status

Update this through real PRs. Do not backdate progress.

## Current phase
M8 physical verification complete; M9 documentation freeze

## Repository
- [x] frontend structure
- [x] backend structure
- [x] docs baseline
- [x] CI
- [x] completion branch `fix/final-project-completion` validated at `262a06ed8383aa563e4bc36286e2d28420b5d6d1` (PR #60 remains open; not merged to `develop`)

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
- [x] interactive Community Safety Map with viewport queries, public Incident markers/callouts, privacy-safe approximate public-area polygons, and refresh after successful report return
- [x] Map Incident filters: category, severity, occurrence date, and time of day
- [x] draggable **Reports in this area** sheet with visible count/list, row-to-Map focus, and truthful zero-report state
- [x] Area Safety Context: real total/recent reports, category/severity breakdowns, real zero state, truthful unavailable state, Retry, and no fabricated local summary
- [x] HS-78/HS-79/HS-77/HS-134 nearby support places: server-side OpenStreetMap/Overpass data, explicit search, dedicated markers, human-readable category and approximate straight-line distance, OSM attribution, and no synthetic fallback
- [x] shared Map location state with contextual foreground permission requests, granted-permission reuse, usable denied/unavailable state, and no fake user coordinate
- [x] Map accessibility semantics, Dynamic Type/Larger Text adaptations, VoiceOver validation, and physical-device validation
- [ ] optional/future: clustering and heatmap when real Incident volume warrants them


### Sandaruwan
- [x] destination search and geocoding integration
- [x] selected destination display and coordinates handoff to route planning
- [x] provider route alternatives
- [x] risk comparison and Journey handoff

### Eshan
- [x] journey state machine
- [x] foreground tracking and lifecycle cleanup
- [x] arrival/outcome
- [x] analytics

## Baseline change log
`YYYY-MM-DD | PR # | Change | Reason`

## Current completion validation

- [x] frontend remote CI: 11 Jest suites, 63 tests
- [x] backend remote CI: 34 test files, 323 tests
- [x] physical Android M8 verification on SDK 57 / Expo Go
- [x] journey raw-coordinate terminal purge and UNKNOWN fallback documented
- [x] local journey notification fallback-channel behavior verified

Known P2 quality item: Expo notifications reports a `shouldShowAlert` deprecation warning; notification behavior remains verified on the tested device.

Remote `npm ci` also reports dependency-audit findings (frontend: 71 vulnerabilities including 1 critical; backend: 9 including 1 critical). No package changes are made in M9; review and remediation are required before production deployment.

## Deferred production verification

- [ ] iOS physical-device verification
- [ ] custom Android binary/native Google Maps SDK key and signing configuration
- [ ] external Geoapify credential rotation and production secret provisioning
- [ ] remote push/Safety Updates delivery infrastructure
- [ ] distributed multi-instance limiter and production observability review

## Historical Phase 3 backend validation

- [x] authorization matrix tests
- [x] moderation response privacy-leakage tests
- [x] concurrent claim and decision tests
- [x] moderator action idempotency tests
- [x] transaction rollback tests
- [x] Community Verification preservation tests
- [x] public visibility regression tests
- [x] historical backend tests passing (26 files, 193 tests)
- [x] backend typecheck passing
- [x] backend lint passing
- [x] backend build passing
