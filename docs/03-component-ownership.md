# Component Ownership

## Shiham
Primary:
- `frontend/src/features/incidents`
- incident and moderator routes
- `backend/src/modules/incidents`
- `backend/src/modules/community-verification`
- `backend/src/modules/moderation`

Supporting foundation:
- initial auth/users/backend common setup

## Naji
- `frontend/src/features/map`
- `backend/src/modules/map`
- shared geospatial utilities
- Map screen/container and the presentation surface that hosts Routing UI

## Sandaruwan
- `frontend/src/features/routing`
- `backend/src/modules/routes`
- origin/destination, route alternatives, reported-risk comparison, and Journey handoff
- public Routing exports consumed by Map

## Eshan
- `frontend/src/features/journeys`
- `backend/src/modules/journeys`

## Shared files requiring coordination
- `frontend/app/_layout.tsx`
- `frontend/app/(tabs)/_layout.tsx`
- `frontend/src/components/*`
- `frontend/src/theme.ts`
- `frontend/src/config/*`
- `frontend/src/services/api/*`
- `frontend/src/types/*`
- `backend/src/app.ts`
- `backend/src/server.ts`
- `backend/src/config/*`
- `backend/src/common/*`
- `.github/workflows/*`

Do not import another feature's internal implementation directly; use agreed contracts/public exports.

Map owning the combined presentation does not merge the technical features. Map consumes Routing through `frontend/src/features/routing/index.ts` (or an equivalent documented public boundary); Routing does not modify Map internals for each integration.

Safety Updates/notifications are a shared supporting concern rather than one of the four major assessed components. Coordinate changes that affect an owned feature.
