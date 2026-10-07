# System Architecture

## Repository
```text
herpath-womens-safety-network/
├── frontend/
├── backend/
├── docs/
└── .github/
```

Frontend and backend are independent npm projects.

## Runtime architecture
```text
Expo SDK 57 React Native App
        |
        | HTTPS REST /api/v1
        v
Node.js + Express modular backend
        |
        +-- MongoDB Atlas
        +-- map tile proxy: Geoapify tiles served through HerPath `/map/tiles/*`
        +-- Geoapify Address Autocomplete and Places APIs (destination search)
        +-- OpenStreetMap / Overpass (Map support places)
        +-- Google Routes API
        +-- local journey notification orchestration
```

The frontend must never connect directly to MongoDB.

## Frontend
Keep Expo Router route files thin. Business logic belongs in:
```text
src/features/auth
src/features/incidents
src/features/map
src/features/routing
src/features/journeys
```

## Backend
```text
src/
├── app.ts
├── server.ts
├── config/
├── common/
└── modules/
    ├── auth/
    ├── users/
    ├── incidents/
    ├── moderation/
    ├── map/
    ├── routes/
    ├── journeys/
    └── notifications/
```

## Database
Use MongoDB GeoJSON with `[longitude, latitude]` and `2dsphere` indexes for geospatial queries. Journey raw path, check-in, and deviation coordinates are purged when a journey reaches a terminal state; current privacy behavior is not a raw-coordinate TTL design.

On Android, the client map path is `MapView mapType="none" → UrlTile → HerPath backend /api/v1/map/tiles/*`. Geoapify credentials are backend-only. Expo Go does not require a project Google Maps key; a custom Android binary using `react-native-maps` still requires a separate restricted Google Maps Android SDK key and signing identity, which is deferred in the current repository.

## Incident location boundary

The Incident backend owns H3 resolution-8 conversion and the public projection. Exact-private reports retain a separately protected private Point; approximate-only reports store no private Point. The persisted and indexed `publicLocation` is the selected/derived H3 center, while `publicArea` is derived from the internal cell when returned. Map consumes the Incident-owned public reader and never imports the Incident model or repository directly.

## Incident lifecycle boundary

The Incident module owns three independent server-controlled lifecycle axes: public visibility,
community evidence, and moderation workflow. `visibilityState` alone controls whether a report is
available to public readers. `communityState` summarizes evidence without asserting truth, while
`moderationState` records workflow progress. `lifecycleRevision` provides the concurrency
foundation for later moderated changes.

The persisted `status` field remains a derived compatibility projection for existing consumers.
Owner and Map response shapes remain unchanged during Phase 1 and do not expose lifecycle fields.
At the time of the foundation baseline, no moderation or community-verification API/module was introduced. The current implementation has these modules and their audited APIs; this sentence is historical context, not the current architecture.

## Community verification boundary

Community verification stores actor-private feedback events separately from Incident reports.
The module evaluates current active feedback deterministically into a per-incident evidence
snapshot, then updates only the Incident compatibility fields owned by that evaluation:
`communityState`, `supportCount`, derived `status`, and lifecycle revision.

Incident visibility remains authoritative and independent. Feedback APIs consume a protected
Incident target projection for eligibility, while Map and Routing consume only the Incident public
reader. Neither public consumer imports feedback records, actor identities, or verification storage.

Evidence ageing is reconciled by an explicit dry-run/apply command. No background scheduler is
introduced in this phase.
