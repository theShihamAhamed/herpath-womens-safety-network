# Domain Rules

These are invariants.

## Incidents
- Store private/original coordinates separately from public/approximate coordinates.
- Public endpoints never expose the private location.
- `EXACT_PRIVATE` requires a deliberately selected private Point and publishes only H3 resolution-8 geometry derived by the backend.
- `APPROXIMATE_ONLY` accepts only a server-catalogued resolution-8 cell identifier, stores no private location, and must not request or capture device GPS.
- `publicLocation` is a representative H3 center, not the incident location; `publicArea` is derived and not persisted.
- Community support increases confidence but does not prove an incident.
- Possible duplicates require review; proximity alone must not auto-delete.
- Moderation decisions are audited.

Suggested statuses:
```text
PENDING
PUBLISHED_UNVERIFIED
COMMUNITY_SUPPORTED
MODERATOR_REVIEWED
DISPUTED
REJECTED
ARCHIVED
```

New reports in the initial reporting slice use `PUBLISHED_UNVERIFIED`. Public reads use an explicit allowlist that initially contains only this status.

`occurredAt` is the reporter-selected time of the event and is stored as an absolute instant. `createdAt` and `updatedAt` are server-controlled receipt/audit timestamps.

Submission retries use a UUIDv4 `clientSubmissionId` scoped to the authenticated `reporterId`. An identical replay returns the original report; reuse with different normalized content conflicts. Geographic proximity is never an idempotency or duplicate key.

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
