# Domain Rules

These are invariants.

## Incidents
- Store private/original coordinates separately from public/approximate coordinates.
- Public endpoints never expose the private location.
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
