# Naji — Community Safety Map and Location Intelligence

## Component overview

Naji owns the Map workspace, public incident-location visualization, map filters, visible-area queries, area summaries, and reusable public-coordinate contracts. It provides geographic safety context; it never labels an area, route, or place as safe.

## Objectives and functional scope

- Render an interactive Google map through `react-native-maps`.
- Request foreground location only in context and retain a usable Colombo fallback when permission is denied or unavailable.
- Load public incident projections for the visible bounding box, show a marker/callout for each projection, and expose category, severity, and absolute occurrence-range filters.
- Let people pan, zoom, inspect markers, and long-press an area for an area-level summary.
- Keep Map’s route-planning integration at `frontend/src/features/routing`’s public export boundary.
- Support future clustering and heatmap rendering once real incident volume warrants it. Neither is enabled in the current slice.

Location/place search is owned by the Routing feature’s Google Places flow, which is hosted by Map through its public integration boundary. Nearby safe places require an approved data source and are intentionally not fabricated.

## Privacy and marker contract

Public markers contain only this projection:

```ts
{
  id, category, severity, status, occurredAt, createdAt, supportCount,
  publicLocation: { type: 'Point', coordinates: [longitude, latitude] },
  publicArea: { type: 'Polygon', coordinates: [...] }
}
```

`publicLocation` is the representative center of the incident component’s public H3 area, not the exact incident location. `publicArea` is a derived public GeoJSON polygon and is not persisted. Raw/private reporting coordinates are never accepted by, logged by, returned by, or rendered in this component. Map-facing wording must describe `supportCount` as community support, never confirmation.

The incident-reporting component must retain private coordinates separately and produce the public approximation before persisting/publishing. Its newly published public projection can then appear in the map query without coupling either feature to the other’s internals.

## Map integration and configuration

The approved provider is Google Maps through `react-native-maps` (ADR-003); foreground location uses Expo SDK 54’s `expo-location`. Native Google Maps API-key setup is required for standalone Android/iOS builds as documented by Expo and must use a restricted key supplied through deployment configuration—never source control. Google Places credentials are backend configuration, not client secrets.

The client initializes around the permitted user location or the non-sensitive fallback region. Camera changes make a bounding-box request. The backend uses the existing `/api/v1` envelope and validates all query parameters before handing them to its map service.

## API/data contracts

| Endpoint | Purpose | Query |
| --- | --- | --- |
| `GET /api/v1/map/incidents` | Public incidents whose public H3 center is in the visible map area | `swLat`, `swLng`, `neLat`, `neLng`; optional `category`, `severity`, `occurredFrom`, `occurredTo` |
| `GET /api/v1/map/area-summary` | Aggregate public context near a selected point | `lat`, `lng`, optional `radius` (100–10,000m), `occurredFrom`, `occurredTo` |

`occurredFrom` and `occurredTo` are inclusive absolute instants and require an ISO-8601 `Z` suffix or explicit numeric offset. Public visibility uses the explicit `PUBLISHED_UNVERIFIED` allowlist. Viewports are non-wrapping in v1, and inclusion is based on the representative `publicLocation` center rather than polygon intersection.

## Data flow and reuse

```text
Public incident projection → map service viewport query → Map screen
→ markers / filters / area summary → user inspection
```

Shiham supplies public incident projections through the Incident-owned public reader; Map never imports the Incident model or repository. The reader queries the indexed public GeoJSON center and converts every result through the explicit public projection before Map receives it. Sandaruwan consumes the map’s geographic context while retaining route-risk ownership; Eshan can reuse public coordinate and viewport contracts but must keep active journey points private.

## Testing

Verify map loading, pan/zoom, permitted and denied location states, empty/network states, marker callouts, every filter, long-press area summary, and that API responses never include private coordinates. Test normal and increased text sizes and TalkBack. Add clustering/heatmap tests when real marker-density behavior is implemented.

## Implementation status

Implemented: Expo SDK 54-compatible map and foreground location dependencies, map surface, viewport and summary endpoints, category/severity filters, privacy-safe persisted Incident integration, occurrence-range filtering through `occurredFrom`/`occurredTo`, permission fallback, explicit empty state, neutral community-support wording, and the component integration boundary. The frontend contract consumes `occurredAt`, `createdAt`, `publicLocation`, and `publicArea`; time-of-day filtering is applied locally to `occurredAt`.

Pending Map-owner work: render `publicArea` as an honest approximate-area overlay and refresh Map data after returning from a successful report. Current markers remain centered on the representative public point. Place search, safe places, clustering, and heatmap await their approved provider/data contracts or sufficient real data.
