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

Authenticated anonymous and registered actors may submit one current feedback position per public
incident, except on their own reports. Supported responses are `SUPPORT`, `RESOLVED`, `DISPUTE`,
and `UNSURE`. Feedback actor identity and client mutation IDs are never public.

Baseline evidence weight is always one. Only active, unexpired directional responses contribute to
community state. Directional evidence expires at 30 days; `UNSURE` is non-directional and carries
zero evidence weight. `supportCount` is the current number of contributing `SUPPORT` responses,
not a cumulative vote total and not proof that a report is true.

`SUPPORTED` and `LIKELY_RESOLVED` require at least three matching directional responses, at least
two-thirds dominance, and opposing weight below two. `CONFLICTED` requires at least two response
positions with weight two or greater. If directional feedback exists but all of it has expired, the
state is `STALE`; otherwise insufficient evidence remains `UNVERIFIED`.

Feedback mutation IDs are actor-scoped UUIDv4 idempotency keys. Identical replays are safe, reuse
with different content conflicts, and mutations are subject to a 15-minute actor cooldown and a
configurable per-actor quota. Community feedback does not alter `visibilityState` or
`moderationState`.

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
