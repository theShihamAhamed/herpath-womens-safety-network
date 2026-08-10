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

## Suggested route groups
```text
app/
├── _layout.tsx
├── index.tsx
├── (auth)/
├── (tabs)/
├── incident/
├── route/
├── journey/
└── moderator/
```

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
