# Product Baseline

HerPath is a privacy-conscious React Native mobile application that combines community incident reports, map intelligence, route alternatives, and actual journey outcomes.

## Core principle
HerPath provides safety context. It never guarantees that a route or place is safe.

## Platform
- React Native
- Expo SDK 57 (validated on Expo Go 57.0.9)
- TypeScript
- Android-first, iOS-compatible architecture
- Node.js + Express + TypeScript backend
- MongoDB Atlas

## Four major components
1. Incident Reporting, Community Verification and Moderation — Shiham
2. Community Safety Map and Location Intelligence — Naji
3. Safe-Route Planning and Route-Risk Evaluation — Sandaruwan
4. Active Journey Tracking, Journey Outcomes and Safety Analytics — Eshan

Authentication, shared UI, common backend infrastructure, notifications, CI, and repository integration are supporting concerns.

The original component assignments above are retained as project-history evidence. Final completion stabilization/integration was led by Shiham on the completion branch, but integration activity does not transfer ownership of another member's component.

## Verified completion state

At tested SHA `262a06ed8383aa563e4bc36286e2d28420b5d6d1`, M8 physical Android verification passed on Expo Go. Frontend remote CI passed with 11 suites/63 tests and backend remote CI passed with 34 test files/323 tests. No P0/P1 application/device blocker remains in the assessed scope. Custom Android native-build credentials, iOS physical verification, external Geoapify rotation, remote push delivery, and multi-instance production validation remain deferred.

## Initial scope
- anonymous/pseudonymous reporting
- approximate public incident locations
- safety map with filters/clusters
- walking route alternatives
- deterministic route-risk comparison
- opt-in active journey tracking
- explicit journey outcome
- moderation and audit history
- route/area aggregate statistics

## Out of scope
- AI prediction
- police/government integration
- automatic emergency dispatch
- continuous tracking outside active journeys
- public free-text social feed
- CCTV/wearables/automatic distress detection
- guaranteed-safe claims
