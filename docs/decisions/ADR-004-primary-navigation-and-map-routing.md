# ADR-004: Primary Navigation and Map/Routing Integration

**Status:** Accepted baseline

## Context

The initial mobile shell exposed five permanent tabs: Map, Routes, Report, Alerts, and Profile. Routes and Alerts fragmented closely related tasks and gave supporting destinations the same visual priority as the app's repeated primary destinations.

Map and Route Planning are distinct technical components with separate owners, but users experience destination search, geographic context, route alternatives, and reported-risk evidence as one spatial task. Safety Updates and Active Journey are contextual destinations rather than persistent workspaces.

## Decision

- Change the bottom navigation from five items to three.
- The final persistent tabs are **Map**, **Report**, and **Profile**.
- Map remains the default destination after session restoration.
- Route Planning becomes part of the Map UX.
- Routing remains technically separate and owned through `frontend/src/features/routing` and `backend/src/modules/routes`.
- The Map container consumes Routing through public exports rather than importing internal files.
- Alerts becomes the nested **Safety Updates** screen, opened from the Map header bell.
- Active Journey remains a nested, focused flow.

## Rationale

This reduces navigation fragmentation, keeps spatial tasks together, improves the prominence of the three repeated destinations, and preserves technical ownership for parallel feature development.

## Consequences

- Routes and Alerts are not registered or retained as hidden tabs.
- Routing must maintain a clear public integration boundary for Map.
- Safety Updates requires an accessible Map entry point and back navigation.
- Future route and journey work must preserve uncertainty-aware safety language and must not claim that a route or place is guaranteed safe.
