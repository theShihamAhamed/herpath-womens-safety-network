# Navigation and Core Flows

## Bottom tabs

```text
Map
Routes
Report
Alerts
Profile
```

Active journey screens are nested flows, not a permanent bottom tab.

## Mobile shell route groups

```text
app/
├── _layout.tsx
├── index.tsx
├── (auth)/
│   ├── sign-in.tsx
│   └── sign-up.tsx
├── (tabs)/
│   ├── map.tsx
│   ├── routes.tsx
│   ├── report.tsx
│   ├── alerts.tsx
│   └── profile.tsx
└── moderator/
    └── index.tsx
```

The root layout waits for session restoration before exposing routes. Auth routes are available to anonymous actors. The moderator group is available only when the backend actor has `role = MODERATOR`; this client guard does not replace backend authorization.

## Startup authentication

```text
App start → read native refresh token
  → stored token: rotate token → verify actor through /auth/me
  → no token: create anonymous session → verify actor through /auth/me
  → invalid/revoked token: clear token → create anonymous session
  → backend unavailable: recoverable retry state
  → ready: enter Map tab
```

The five feature tabs are shell placeholders in PR 4. Incident reporting, map behavior, route-risk comparison, alerts, and journey functionality remain unimplemented.

## Incident

```text
Report → privacy notice → category → approximate location
→ date/time → severity → optional description → review → submit
```

## Map

```text
Open map → optional location permission → viewport data
→ clusters/approximate markers → filters → incident/area detail
```

## Route

```text
Origin → destination → alternatives → safety evidence
→ comparative explanation → select route → optionally start journey
```

## Journey

```text
Selected route → explanation/consent → ACTIVE
→ tracking/check-ins/deviation → arrival detected
→ explicit SAFE_CONFIRMED or INCIDENT_REPORTED
→ UNKNOWN if unresolved → stop tracking → update aggregates
```

## Moderator

```text
Moderator access → queue → review report
→ privacy/duplicate checks → action + reason
→ concurrency check → status update → audit record
```
