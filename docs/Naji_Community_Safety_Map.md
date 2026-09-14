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

Destination/location search is owned by the Routing feature and is hosted by Map through its public integration boundary. Nearby support-place discovery is Map-owned and uses the approved OpenStreetMap data path; it never uses Routing's destination-search fallbacks.

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

The approved map renderer is Google Maps through `react-native-maps` (ADR-003); foreground location uses Expo SDK 54’s `expo-location`. Native Google Maps API-key setup is required for standalone Android/iOS builds as documented by Expo and must use a restricted key supplied through deployment configuration—never source control.

Nearby support-place data is queried server-side from OpenStreetMap through Overpass. `OVERPASS_API_URL` defaults to the public interpreter endpoint and is configurable without credentials. The provider sends a HerPath User-Agent, applies a bounded timeout, and is protected by a small in-process spatial cache plus in-flight request deduplication. The Map API must not fabricate places or fall back to Routing/Nominatim data. When support places are presented in HS-77 or HS-79, the relevant Map surface must show `© OpenStreetMap contributors` attribution.

The client initializes around the permitted user location or the non-sensitive fallback region. Camera changes make a bounding-box request. The backend uses the existing `/api/v1` envelope and validates all query parameters before handing them to its map service.

## API/data contracts

| Endpoint | Purpose | Query |
| --- | --- | --- |
| `GET /api/v1/map/incidents` | Public incidents whose public H3 center is in the visible map area | `swLat`, `swLng`, `neLat`, `neLng`; optional `category`, `severity`, `occurredFrom`, `occurredTo` |
| `GET /api/v1/map/area-summary` | Aggregate public context near a selected point | `lat`, `lng`, optional `radius` (100–10,000m), `occurredFrom`, `occurredTo` |
| `GET /api/v1/map/support-places` | Real nearby support resources from OpenStreetMap via Overpass | `latitude`, `longitude`, optional `radius` (100–5,000m; default 2,000m) |

`occurredFrom` and `occurredTo` are inclusive absolute instants and require an ISO-8601 `Z` suffix or explicit numeric offset. Public visibility uses the explicit `PUBLISHED_UNVERIFIED` allowlist. Viewports are non-wrapping in v1, and inclusion is based on the representative `publicLocation` center rather than polygon intersection.

### Nearby support-place contract

`GET /api/v1/map/support-places` returns only named, normalized real OSM POIs: `id` (`node/123`, `way/123`, or `relation/123`), `name`, `category`, and `location` (`latitude`, `longitude`). Nodes use their OSM coordinates; ways and relations use an Overpass-provided center. Unnamed, malformed, unrelated, or insufficiently tagged POIs are excluded rather than given a made-up name or category. An empty valid provider result is `200` with `[]`; provider failures, including rate limiting, return the standard unavailable error and never substitute mock locations.

| HerPath category | Deterministic OSM mapping |
| --- | --- |
| `POLICE` | `amenity=police` |
| `MEDICAL` | `amenity=hospital` or `amenity=clinic` |
| `EMERGENCY` | `amenity=fire_station` or `emergency=ambulance_station` |
| `WOMENS_SUPPORT` | `amenity=social_facility` with `social_facility=shelter` or `outreach` and `social_facility:for=woman` |
| `COUNSELLING_SUPPORT` | `healthcare=counselling`, or `amenity=social_facility` + `social_facility=outreach` + `social_facility:for` of `abused`, `victim`, or `mental_health` |

These mappings intentionally do not infer services from POI names. They also do not attempt to discover non-public shelters, which may correctly be absent from OSM. HS-78 establishes the backend contract only; HS-79 owns the user-triggered nearby-search interaction, and HS-77 owns marker presentation.

### Nearby support-place search

HS-79 adds one explicit **Nearby support** Map action. It searches only around a successfully resolved, foreground-permission-granted current user location; it does not use the Colombo display fallback, ask for an additional permission, query while the Map camera moves, or offer competing search contexts. The action is disabled while a request is active.

The Map retains normalized results locally for HS-77, but HS-79 does not render support-place markers, place lists, category labels, distance, or routing actions. Its compact feedback distinguishes idle, loading, results, a neutral empty response, provider unavailability with retry, and unavailable location. Provider-derived result feedback includes `© OpenStreetMap contributors` attribution.

## Data flow and reuse

```text
Public incident projection → map service viewport query → Map screen
→ markers / filters / area summary → user inspection
```

Shiham supplies public incident projections through the Incident-owned public reader; Map never imports the Incident model or repository. The reader queries the indexed public GeoJSON center and converts every result through the explicit public projection before Map receives it. Sandaruwan consumes the map’s geographic context while retaining route-risk ownership; Eshan can reuse public coordinate and viewport contracts but must keep active journey points private.

## Map-first interaction model

The Map tab keeps the safety map as the primary workspace instead of placing it in a fixed-height card. The existing destination entry remains a Map-side integration point for the Routing feature; it does not calculate routes or perform geocoding itself. Incident filters live behind a compact overlay button, while current-location and area-context actions remain as labelled 48 dp floating controls. Long-pressing the map still opens area context, and the same context is available from the floating action at the current map center.

The area-context sheet presents total and recent public-report counts, followed by available category and text-labelled severity breakdowns. It omits those breakdowns when there are no public reports, retaining the available-community-data disclaimer rather than inferring that the area is safe.

### Report context sheet

The Map includes a bottom report-context sheet for the incidents visible in the current viewport and active filters. Its compact state is limited to a grab handle, title, and visible public-report count so the map remains dominant. Users can tap the labelled header or drag its handle upward; the sheet follows the gesture continuously within its collapsed and expanded bounds, then settles to the nearest state with the release direction considered. Dragging the header downward from the expanded state uses the same interaction. The expanded state lists only the public category, text severity, occurrence time, and community-support count already returned by the public Map API. Selecting a row centers the Map on that report's approximate public-area center and returns the sheet to its compact state.

The sheet states that community-reported locations are approximate areas rather than exact locations. It does not calculate a score, infer safety, access private coordinates, or introduce any new incident data. When no reports match the current view, it explicitly notes that this is not proof that the area is safe. The expand/collapse control and report rows have accessible names and actions.

## Testing

Verify map loading, pan/zoom, permitted and denied location states, empty/network states, marker callouts, every filter, long-press area summary, and that API responses never include private coordinates. Test normal and increased text sizes and TalkBack. Add clustering/heatmap tests when real marker-density behavior is implemented.

## Implementation status

Implemented: Expo SDK 54-compatible map and foreground location dependencies, map surface, viewport and summary endpoints, category/severity filters, privacy-safe persisted Incident integration, occurrence-range filtering through `occurredFrom`/`occurredTo`, permission fallback, explicit empty state, neutral community-support wording, and the component integration boundary. The frontend contract consumes `occurredAt`, `createdAt`, `publicLocation`, and `publicArea`; time-of-day filtering is applied locally to `occurredAt`. The map renders the API-supplied `publicArea` polygon with a subtle outline and fill, plus a clearly labelled coarse center indicator.

`publicArea` is an approximate public area, not an incident boundary or the reported person's location. The Map neither generates its geometry nor receives private coordinates, H3 cell IDs, or Incident descriptions.

Incident callouts use a compact hierarchy: category first, then an explicit text severity label and occurrence time. A single `Community report · Approximate area` line preserves the public status and privacy context without implying confirmation or an exact location. Screen-reader marker labels include the same category, severity, occurrence time, and approximate-area semantics.

When the Map regains focus after a successful report returns the user to `/map`, it reloads the retained visible viewport with the active filters. The refresh keeps the current map context intact and announces a short loading state while public reports are updated.

Support-place data integration and explicit nearby search are implemented through the Map-owned OSM/Overpass contract. Support-place map markers remain HS-77 work; place-detail distance/category presentation remains HS-134 work. Clustering and heatmap still await sufficient real incident data.
