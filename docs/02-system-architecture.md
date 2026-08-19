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
Expo React Native App
        |
        | HTTPS REST /api/v1
        v
Node.js + Express modular backend
        |
        +-- MongoDB Atlas
        +-- Google Places API
        +-- Google Routes API
        +-- notification infrastructure
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
Use MongoDB GeoJSON with `[longitude, latitude]`, `2dsphere` indexes for geospatial queries, and TTL indexes for temporary journey points.

## Incident location boundary

The Incident backend owns H3 resolution-8 conversion and the public projection. Exact-private reports retain a separately protected private Point; approximate-only reports store no private Point. The persisted and indexed `publicLocation` is the selected/derived H3 center, while `publicArea` is derived from the internal cell when returned. Map consumes the Incident-owned public reader and never imports the Incident model or repository directly.
