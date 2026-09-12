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
    ├── _layout.tsx
    ├── index.tsx
    └── cases/
        └── [caseId]/
            ├── index.tsx
            ├── decision.tsx
            └── audits.tsx
```

The root layout waits for session restoration before exposing routes. Auth routes are available to anonymous actors. The moderator group is available only when the backend actor has `role = MODERATOR`; this client guard does not replace backend authorization.

The moderator dashboard uses `/moderator` for the case queue, `/moderator/cases/[caseId]` for privacy-safe case review, `/moderator/cases/[caseId]/decision` for revision-protected decisions, and `/moderator/cases/[caseId]/audits` for chronological audit history.

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
Report tab → DETAILS (What happened?)
→ LOCATION (Where did it happen?)
→ REVIEW (Review & submit)
→ submit → Confirmation
```

From Confirmation, users can return to Map, view My Reports, or start another report. Confirmation is not a fourth reporting stage.

Review Change actions open the relevant DETAILS or LOCATION section. Completing the edit returns directly to Review without forcing traversal through intervening stages. Back navigation and direct editing preserve the draft.

The privacy sheet opens over DETAILS or LOCATION and closes back to the same stage without modifying the draft, location selection, submission state, or retry UUID. My Reports opens as a secondary surface and closes back to the exact previous reporting or confirmation state.

Opening Report does not request location permission. Exact-private current location requests one-time foreground permission only after the explicit action; exact-private manual selection requires a map tap. Approximate-only starts from a display-only Colombo region, requests no device location, loads backend-catalogued coarse areas, and submits only the selected area cell ID.

The draft and its UUIDv4 remain stable after network or server failures so a retry is idempotent. A genuinely new UUID is created only through **Report another incident**. My Reports is owner-scoped, cursor-paginated, refreshable, and never displays coordinates.

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
