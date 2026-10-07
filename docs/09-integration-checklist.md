# Integration Checklist

## Foundation gate (current)

- [x] Expo moved to `frontend/`
- [x] backend initialized
- [x] docs baseline and completion evidence maintained
- [x] `.github/` CI exists
- [x] frontend and backend install/start contracts validated
- [x] `/api/v1/health` and auth contracts validated by CI/device evidence
- [x] no secrets tracked in workflow/configuration review
- [x] anonymous, registered, moderator authorization, restored sessions, and three-tab shell
- [x] Safety Updates opens from the accessible Map bell and can navigate back
- [x] Routes and Alerts are non-tab routes
- [x] shared shell supports larger text and comfortable touch targets

## Incident → Map

- [x] authenticated anonymous and registered incident submission implemented
- [x] exact-private and approximate-only location paths separated
- [x] approximate-only POST contains only a selected server-catalogued cell ID
- [x] H3 resolution-8 public center is persisted/indexed and public area is derived
- [x] owner history is actor-scoped and cursor-paginated
- [x] idempotent replay/conflict and per-actor new-report rate limit implemented
- [x] private/public coordinates separated
- [x] map endpoint exposes the explicit public projection only
- [x] visibility, community evidence, and moderation workflow states are persisted independently
- [x] public Incident reads use visibility with a legacy missing-field fallback
- [x] lifecycle fields remain absent from owner and Map API responses
- [x] lifecycle migration supports aggregate dry-run, idempotent apply, and restricted rollback
- [x] occurrence-range filters use offset-aware `occurredFrom`/`occurredTo`
- [x] newly submitted public incident can render
- [x] Map renders `publicArea` as an honest approximate area rather than only a precise-looking pin
- [x] Android physical-device incident flow verified (M8)
- [ ] iOS physical-device incident flow verified
- [x] increased-text check completed on Android (M8); iOS/screen-reader coverage remains deferred

## Map/Incidents → Route

- [x] Map consumes Routing only through its documented public feature exports
- [x] destination search begins from the Map experience
- [x] route candidates available
- [x] route corridor can query relevant incidents
- [x] route uses approved terminology
- [x] insufficient-data state works
- [ ] no visible reports are never presented as proof of safety

## Route → Journey

- [x] selected-route handoff contract stable
- [x] journey can start from selected route
- [x] tracking begins only after explicit consent and foreground permission

## Journey → Analytics

- [x] safe requires explicit confirmation
- [x] incident remains incident-affected after arrival
- [x] unresolved becomes UNKNOWN
- [x] journey history/analytics aggregates update
- [x] terminal raw coordinates are purged

## Moderation

- [x] incident lifecycle and revision foundation exists
- [x] community feedback records and actor-scoped abuse controls implemented
- [x] deterministic evidence evaluation and current support count implemented
- [x] authenticated feedback, verification status, and eligibility APIs implemented
- [x] due evidence reconciliation supports aggregate dry-run and idempotent apply
- [x] Routing consumes the visibility-authoritative Incident public reader
- [x] abuse flagging implemented with immutable records, idempotency, duplicate prevention, and rate limiting
- [x] moderation cases and priority queue implemented
- [x] moderator claim, release, and reopen workflow implemented
- [x] moderator visibility decisions implemented
- [x] append-only audit logging and privacy-safe audit history implemented
- [x] conflicted evidence reconciliation into moderation intake implemented
- [x] authorization, privacy, concurrency, idempotency, and rollback hardening completed
- [x] rejected/duplicate evidence is recalculated as designed
- [x] concurrent moderator changes do not silently overwrite

## Phase 3 validation coverage

- [x] normal-user denial and moderator authorization tested across moderation endpoints
- [x] queue, detail, and audit projections tested for sensitive-data leakage
- [x] concurrent case claims and decisions permit only one committed mutation
- [x] claim, release, reopen, and decision idempotency tested
- [x] transaction rollback tested when audit persistence fails
- [x] moderation decisions preserve Community Verification state, support count, and feedback
- [x] hidden/archived incidents remain excluded and restored incidents return to public reads
- [x] backend tests, typecheck, lint, and build passed for Phase 3

## Deferred production/device gate

- [x] M8 physical Android verification completed on SDK 57 / Expo Go
- [ ] iOS physical-device verification
- [ ] custom Android standalone/development build with a genuine Google Maps Android SDK key, package restriction, and signing SHA-1
- [ ] external Geoapify credential rotation (`EXTERNAL GEOAPIFY CREDENTIAL ROTATION REQUIRED`)
- [ ] remote push/Safety Updates delivery infrastructure
- [ ] multi-instance production limiter and observability validation
