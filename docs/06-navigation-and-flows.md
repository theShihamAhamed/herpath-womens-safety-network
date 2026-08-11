# Navigation and Core Flows

## Bottom tabs

```text
Map
Report
Profile
```

Route Planning is part of the Map experience. Safety Updates and Active Journey are nested flows, not permanent bottom tabs.

## Mobile shell route groups

```text
app/
├── _layout.tsx
├── index.tsx
├── alerts.tsx
├── (auth)/
│   ├── sign-in.tsx
│   └── sign-up.tsx
├── (tabs)/
│   ├── map.tsx
│   ├── report.tsx
│   └── profile.tsx
└── moderator/
    └── index.tsx
```

The root layout waits for session restoration before exposing routes. Auth routes are available to anonymous actors. The moderator group is available only when the backend actor has `role = MODERATOR`; this client guard does not replace backend authorization.

Safety Updates is a root-stack screen opened from the Map bell. Native stack navigation provides the back path. Routes and Alerts must not remain registered as hidden tabs.

## Startup authentication

```text
App start → read native refresh token
  → stored token: rotate token → verify actor through /auth/me
  → no token: create anonymous session → verify actor through /auth/me
  → invalid/revoked token: clear token → create anonymous session
  → backend unavailable: recoverable retry state
  → ready: enter Map tab
```

## Map and Route Planning

```text
Map → Where are you going? → From / To
→ route alternatives → reported-risk evidence
→ comparative explanation → select route → optionally start journey
```

Map owns the presentation container, map/location context, markers/filters, and area summaries. Routing remains separately owned and is inserted through its public feature exports. No visible reports must never be interpreted as proof that an area is safe.

## Safety Updates

```text
Map bell → Safety Updates → optional future deep link → Back
```

The current shared foundation contains an empty state only. Notification delivery, unread state, preferences, and deep-link behavior are future work.

## Incident

```text
Report → privacy notice → category → approximate location
→ date/time → severity → optional description → review → submit
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
