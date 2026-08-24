# Domain Rules

These are invariants.

## Incidents
- Store private/original coordinates separately from public/approximate coordinates.
- Public endpoints never expose the private location.
- `EXACT_PRIVATE` requires a deliberately selected private Point and publishes only H3 resolution-8 geometry derived by the backend.
- `APPROXIMATE_ONLY` accepts only a server-catalogued resolution-8 cell identifier, stores no private location, and must not request or capture device GPS.
- `publicLocation` is a representative H3 center, not the incident location; `publicArea` is derived and not persisted.
- Community evidence can increase or reduce confidence but does not prove or disprove an incident.
- Possible duplicates require review; proximity alone must not auto-delete.
- Moderation decisions are audited.

Lifecycle concerns are independent and server-controlled:

Visibility state:
```text
PUBLIC
HIDDEN
ARCHIVED
```

Community evidence state:
```text
UNVERIFIED
SUPPORTED
CONFLICTED
LIKELY_RESOLVED
STALE
```

Community state represents evidence, not truth or verification.

Moderation workflow state:
```text
NOT_QUEUED
QUEUED
IN_REVIEW
AWAITING_REPORTER
RESOLVED
```

Moderation state records workflow and does not implicitly hide a report. Public availability is
controlled only by `visibilityState`. New reports default to `PUBLIC`, `UNVERIFIED`,
`NOT_QUEUED`, and `lifecycleRevision: 0`, so reports remain immediately public.

The existing compatibility statuses remain temporarily:
```text
PENDING
PUBLISHED_UNVERIFIED
COMMUNITY_SUPPORTED
MODERATOR_REVIEWED
DISPUTED
REJECTED
ARCHIVED
```

`status` is derived from the lifecycle axes in this precedence: archived, hidden, moderation
resolved, community conflicted, community supported, then published unverified. It is not the
authoritative public-visibility field. `supportCount` also remains temporarily for current API
compatibility and is not proof.

During migration, only a legacy document with all lifecycle fields absent and
`status: PUBLISHED_UNVERIFIED` receives the public compatibility fallback. Partially migrated
documents fail closed.

`occurredAt` is the reporter-selected time of the event and is stored as an absolute instant. `createdAt` and `updatedAt` are server-controlled receipt/audit timestamps.

Submission retries use a UUIDv4 `clientSubmissionId` scoped to the authenticated `reporterId`. An identical replay returns the original report; reuse with different normalized content conflicts. Geographic proximity is never an idempotency or duplicate key.

Phase 1 exposes no community-feedback, flagging, evidence-evaluation, or moderation endpoints.

## Journeys
Status and safety outcome are separate.

Safety outcomes:
```text
SAFE_CONFIRMED
INCIDENT_REPORTED
UNKNOWN
```

Rules:
- GPS arrival never automatically creates `SAFE_CONFIRMED`.
- Safe arrival requires explicit user confirmation.
- A journey with an incident remains incident-affected even if the destination is reached later.
- unresolved/expired/force-closed journeys become `UNKNOWN`.
- `UNKNOWN` is never counted as safe.

## Statistics
```text
Resolved Journeys =
Safe-Confirmed Journeys + Incident-Affected Journeys
```

```text
Raw Incident-Affected Rate =
Incident-Affected Journeys / Eligible Started Journeys × 100
```

```text
Observed Incident-Affected Rate =
Incident-Affected Journeys / Resolved Journeys × 100
```

## Route language
Use:
- lower reported-risk
- higher reported-risk
- insufficient data
- based on available community data

Never use:
- guaranteed safe
- completely safe
- danger-free
