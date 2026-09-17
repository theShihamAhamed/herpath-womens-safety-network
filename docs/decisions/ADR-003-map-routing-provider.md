# ADR-003: Map and Routing Provider

**Status:** Accepted baseline

- Map rendering: `react-native-maps` using Google Maps
- Destination search: Geoapify Address Autocomplete with conditional Geoapify Places/category and amenity requests, through the HerPath backend; provider metadata is normalized before it reaches the client
- Nearby support places: OpenStreetMap data through Overpass, through the Map backend contract (separate from destination search)
- Route alternatives: OpenStreetMap routing services (OSRM-compatible, no API key required)
- Safety/risk evaluation: HerPath backend

Provider geometry/time/distance is separate from HerPath safety evidence and recommendation logic.

Destination search may use real shared location as a proximity bias and a local-first pass, while retaining worldwide provider fallback. It has no permanent country or global-radius restriction and never creates synthetic destinations. The Map presents submitted destination results as temporary markers and a sheet; destination selection continues through Routing-owned state.
