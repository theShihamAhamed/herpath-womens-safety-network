# HerPath UX Information Architecture

## Objective

HerPath is a safety decision-support application. The experience must minimize unnecessary navigation, keep related spatial tasks together, and remain understandable across ages, levels of digital confidence, and accessibility needs.

## Primary navigation

The permanent bottom navigation is:

```text
Map | Report | Profile
```

- **Map** is the central workspace for destination search, geographic context, nearby reports, route comparison, and future journey entry.
- **Report** provides incident reporting and, later, the user's report history/status.
- **Profile** provides identity, authentication, preferences, history, privacy information, and eligible moderator access.

## Nested destinations

Routes is not a permanent tab. Route planning begins in Map:

```text
Map → Where are you going? → From / To → route alternatives
→ reported-risk comparison → select route → optionally start journey
```

Safety Updates is opened from the Map header bell at `/alerts`. Active Journey is also a nested, high-focus flow rather than a tab. Moderator routes remain role-protected and are not exposed as normal-user navigation.

## Route architecture

```text
app/
├── (tabs)/
│   ├── map
│   ├── report
│   └── profile
├── alerts
├── moderator/
└── (auth)/
    ├── sign-in
    └── sign-up
```

Future incident, route-detail, and journey routes should be added only when their features are implemented. Do not create fake empty routes in advance.

After session restoration, Map is the default destination.

## Map information hierarchy

1. Current task and destination search
2. Map and geographic context
3. Immediate area safety context
4. Route alternatives after a search
5. Detailed evidence on demand
6. Secondary controls and settings

The first screen must not expose every possible control at once. No visible reports must never be interpreted as evidence that an area is safe.

## Ownership

Presentation integration does not merge ownership:

- Naji owns `frontend/src/features/map` and `backend/src/modules/map`.
- Sandaruwan owns `frontend/src/features/routing` and `backend/src/modules/routes`.
- Map may consume Routing only through documented public exports.
- Neither feature imports the other's internal implementation.

Permanent navigation reflects the user's repeated mental model, not every technical feature directory.
