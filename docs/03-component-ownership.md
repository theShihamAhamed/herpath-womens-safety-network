# Component Ownership

## Shiham
Primary:
- `frontend/src/features/incidents`
- incident and moderator routes
- `backend/src/modules/incidents`
- `backend/src/modules/moderation`

Supporting foundation:
- initial auth/users/backend common setup

## Naji
- `frontend/src/features/map`
- `backend/src/modules/map`
- shared geospatial utilities

## Sandaruwan
- `frontend/src/features/routing`
- `backend/src/modules/routes`

## Eshan
- `frontend/src/features/journeys`
- `backend/src/modules/journeys`

## Shared files requiring coordination
- `frontend/app/_layout.tsx`
- `frontend/app/(tabs)/_layout.tsx`
- `frontend/src/services/api/*`
- `frontend/src/types/*`
- `backend/src/app.ts`
- `backend/src/server.ts`
- `backend/src/config/*`
- `backend/src/common/*`
- `.github/workflows/*`

Do not import another feature's internal implementation directly; use agreed contracts/public exports.
