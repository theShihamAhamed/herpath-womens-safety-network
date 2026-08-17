# Naji — Community Safety Map and Location Intelligence

## Component overview

Naji owns the Map workspace, public incident-location visualization, map filters, visible-area queries, area summaries, and reusable public-coordinate contracts. It provides geographic safety context; it never labels an area, route, or place as safe.

## Objectives and functional scope

- Render an interactive Google map through `react-native-maps`.
- Request foreground location only in context and retain a usable Colombo fallback when permission is denied or unavailable.
- Load public incident projections for the visible bounding box, show a marker/callout for each projection, and expose category, severity, date, time-of-day, and date-range filters.
- Let people pan, zoom, inspect markers, and long-press an area for an area-level summary.
- Keep Map’s route-planning integration at `frontend/src/features/routing`’s public export boundary.
- Support future clustering and heatmap rendering once real incident volume warrants it. Neither is enabled against an empty incident source.

Location/place search is owned by the Routing feature’s Google Places flow, which is hosted by Map through its public integration boundary. Nearby safe places require an approved data source and are intentionally not fabricated.

## Privacy and marker contract

Public markers contain only this projection:

```ts
{
  id, category, severity, status, createdAt, supportCount,
  publicLocation: { type: 'Point', coordinates: [longitude, latitude] }
}
```

`publicLocation` is the incident component’s approximate/public GeoJSON location. Raw/private reporting coordinates are never accepted by, logged by, returned by, or rendered in this component. Marker callouts present only category, severity, public status, report time, and community-support count.

The incident-reporting component must retain private coordinates separately and produce the public approximation before persisting/publishing. Its newly published public projection can then appear in the map query without coupling either feature to the other’s internals.

## Map integration and configuration

The approved provider is Google Maps through `react-native-maps` (ADR-003); foreground location uses Expo SDK 54’s `expo-location`. Native Google Maps API-key setup is required for standalone Android/iOS builds as documented by Expo and must use a restricted key supplied through deployment configuration—never source control. Google Places credentials are backend configuration, not client secrets.

The client initializes around the permitted user location or the non-sensitive fallback region. Camera changes make a bounding-box request. The backend uses the existing `/api/v1` envelope and validates all query parameters before handing them to its map service.

## API/data contracts

| Endpoint | Purpose | Query |
| --- | --- | --- |
| `GET /api/v1/map/incidents` | Public incident markers in the visible map area | `swLat`, `swLng`, `neLat`, `neLng`; optional `category`, `severity`, `dateFrom`, `dateTo`, `startHour`, `endHour` |
| `GET /api/v1/map/area-summary` | Aggregate public context near a selected point | `lat`, `lng`, optional `radius` (100–10,000m) |

Until the incident repository is integrated, `/map/incidents` returns an empty list rather than fake reports. The map therefore shows an explicit uncertainty-aware empty state.

## Data flow and reuse

```text
Public incident projection → map service viewport query → Map screen
→ markers / filters / area summary → user inspection
```

Shiham supplies public incident projections; Sandaruwan consumes the map’s geographic context while retaining route-risk ownership; Eshan can reuse public coordinate and viewport contracts but must keep active journey points private. Future map-service implementation should query the incident repository’s public GeoJSON field with a `2dsphere` index and apply these same filters server-side.

## Testing

Verify map loading, pan/zoom, permitted and denied location states, empty/network states, marker callouts, every filter, long-press area summary, and that API responses never include private coordinates. Test normal and increased text sizes and TalkBack. Add clustering/heatmap tests when real marker-density behavior is implemented.

## Implementation status

Implemented: Expo SDK 54-compatible map and foreground location dependencies, map surface, public marker contract/callout, viewport and summary endpoints, category/severity/date/time filters, permission fallback, explicit empty state, and component integration boundary.

Pending cross-component dependency: incident repository/public projection integration. Place search, safe places, clustering, and heatmap await their approved provider/data contracts or sufficient real data.
