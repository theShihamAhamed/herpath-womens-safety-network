# ADR-003: Map and Routing Provider

**Status:** Accepted baseline

- Map rendering: `react-native-maps` using Google Maps
- Place search: Geoapify Address Autocomplete API, through the HerPath backend
- Route alternatives: OpenStreetMap routing services (OSRM-compatible, no API key required)
- Safety/risk evaluation: HerPath backend

Provider geometry/time/distance is separate from HerPath safety evidence and recommendation logic.
