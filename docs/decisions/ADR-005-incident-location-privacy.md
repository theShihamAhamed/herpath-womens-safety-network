# ADR-005: Incident Location Privacy and Public Projection

**Status:** Accepted

## Context

Incident reports are more useful when they contain location context, but an exact incident point can identify a home, workplace, routine, reporter, or another person. HerPath must support both anonymous and registered reporters without exposing their backend ownership identity. Both account types therefore own reports through the authenticated backend actor described in ADR-002.

The public Map needs stable geometry for viewport queries and honest approximate-area presentation. It must not receive reporting-only data or interpret a representative point as the incident's true location.

## Decision

### Location modes

`EXACT_PRIVATE` is a deliberate choice. A reporter either requests a one-time foreground device location or taps an exact point manually. Location permission is requested only after the current-location action. The exact GeoJSON Point is stored as `privateLocation`; the backend converts it to an H3 resolution-8 cell and exposes only geometry derived from that cell.

`APPROXIMATE_ONLY` does not request location permission, call device GPS APIs, or reuse Map's Colombo display fallback. The authenticated client requests server-generated selectable areas for a non-wrapping viewport and submits only `selectedAreaCellId`. The backend receives no precise selected incident coordinate and stores `privateLocation: null`.

### Backend-owned H3 representation

- H3 resolution 8 is owned by the backend; the Expo client has no H3 dependency.
- `publicCellId` is validated and stored internally.
- `publicLocation` is the H3 cell center, stored as a GeoJSON Point with a `2dsphere` index.
- `publicArea` is a closed GeoJSON Polygon derived from the H3 boundary when producing a response; it is not persisted.
- GeoJSON coordinates use `[longitude, latitude]`.

H3 cells vary in shape and physical dimensions. Resolution 8 provides neighborhood-scale coarsening, not a fixed-distance promise or an anonymity guarantee. The cell center is a representative query point, not the incident location.

### Public Map contract

Map receives only:

```text
id, category, severity, status, occurredAt, createdAt, supportCount,
publicLocation, publicArea
```

Map never receives `privateLocation`, `reporterId`, `locationMode`, `publicCellId`, `clientSubmissionId`, `description`, or session/account data. Public visibility uses an explicit allowlist whose initial and only value is `PUBLISHED_UNVERIFIED`. Community support is not proof or verification.

The Map frontend consumes the public Point and Polygon contract, but rendering the Polygon remains Map-owner work. V1 viewport and radius queries include an incident by its representative `publicLocation` center, not polygon intersection. V1 viewports do not wrap across the antimeridian.

### Submission controls

`occurredAt` is selected by the reporter and must include `Z` or an explicit numeric offset. `createdAt` and `updatedAt` are server-controlled.

Idempotency is scoped to `reporterId + clientSubmissionId`:

- a new submission returns HTTP 201;
- the same normalized content returns the existing report with HTTP 200;
- different content returns HTTP 409 `IDEMPOTENCY_CONFLICT`.

The backend checks for an existing idempotency key before reserving the per-actor new-report quota. The default process-local quota is five new submission identifiers per 15 minutes. A shared limiter is required before multi-instance deployment.

## Consequences

- Exact reporting remains useful for future authorized review while public consumers see only coarse geometry.
- Approximate-only reporting provides a stronger data-minimization path because neither the device location nor a precise selected point is submitted.
- The selectable-cell catalog is authenticated, capped at 200 cells, limited to spans of at most 0.1 degrees, and requires the client to pan and zoom manually.
- H3 changes and public projection rules remain centralized in the Incident module.
- Deriving polygons avoids duplicated geometry and drift, at the cost of small response-time computation.
- Center-based viewport inclusion is simple and indexable, but a cell overlapping a viewport can be omitted when its center lies outside. Polygon-intersection behavior can be considered only if a demonstrated Map requirement justifies it.
- The public area reduces precision but does not prevent inference from report text, timing, sparse data, or outside knowledge. Descriptions therefore remain owner-only and the UI warns against identifying details.
