# Integration Checklist

## Foundation gate

- [ ] Expo moved to `frontend/`
- [ ] backend initialized
- [ ] docs committed
- [ ] `.github/` CI exists
- [ ] `develop` exists
- [ ] frontend installs/starts
- [ ] backend installs/starts
- [ ] `/api/v1/health` works
- [ ] no secrets tracked
- [ ] anonymous/pseudonymous auth contract works
- [ ] registered auth works
- [ ] moderator cannot self-assign role
- [ ] restored sessions open the Map tab
- [ ] bottom navigation contains exactly Map, Report, and Profile
- [ ] Safety Updates opens from the accessible Map bell and can navigate back
- [ ] Routes and Alerts have no tab routes or hidden tab registrations
- [ ] shared shell remains usable with larger text and comfortable touch targets

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
- [ ] newly submitted public incident can render
- [ ] Map renders `publicArea` as an honest approximate area rather than only a precise-looking pin
- [ ] Android physical-device incident flow verified
- [ ] iOS physical-device incident flow verified
- [ ] increased-text and screen-reader checks completed on a device

## Map/Incidents → Route

- [ ] Map consumes Routing only through its documented public feature exports
- [ ] destination search begins from the Map experience
- [ ] route candidates available
- [ ] route corridor can query relevant incidents
- [ ] route uses approved terminology
- [ ] insufficient-data state works
- [ ] no visible reports are never presented as proof of safety

## Route → Journey

- [ ] selected-route handoff contract stable
- [ ] journey can start from selected route
- [ ] tracking begins only after explicit consent

## Journey → Analytics

- [ ] safe requires explicit confirmation
- [ ] incident remains incident-affected after arrival
- [ ] unresolved becomes UNKNOWN
- [ ] route/area aggregates update
- [ ] test/demo journeys excluded

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
- [ ] rejected/duplicate evidence is recalculated as designed
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
