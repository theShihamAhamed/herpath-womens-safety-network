# Development Workflow

## Branch model
```text
main    = stable/release state
develop = team integration branch
feature/*, chore/*, fix/* = task branches
```

Create Jira issues before coding when possible.

Examples:
```text
chore/HERPATH-101-repository-structure
feat/HERPATH-120-auth-foundation
feat/HERPATH-210-incident-reporting
```

Commit examples:
```text
HERPATH-101 chore(repo): move Expo app into frontend
HERPATH-110 feat(api): add health endpoint
HERPATH-120 feat(auth): add anonymous session endpoint
HERPATH-210 feat(incidents): add report validation
```

Feature/foundation PRs target `develop`. A tested milestone moves through a reviewed `develop -> main` release PR.

## Foundation order
1. Repository restructure + docs baseline
2. Backend foundation
3. Authentication foundation
4. Mobile shell/auth wiring
5. Release foundation to `main`
6. Parallel component development

## PR evidence
Each PR should include Jira issue, summary, tests, screenshots/API proof where relevant, privacy/security impact, and documentation changes.

Cross-component contract changes must update `docs/` in the same PR.

## Android map testing on Expo SDK 57
The frontend currently uses Expo 57.0.25, React Native 0.86.3, and `react-native-maps` 1.27.2. iOS map rendering has been tested successfully with the default iOS provider.

### Original problem
On Android Expo Go after the SDK 57 upgrade, the Google/native base map could remain black while the UI, API features, and support-place data continued to work. Source inspection found valid MapView dimensions and no custom style or tile layer causing it.

### Final implemented solution
Android retains `react-native-maps`, sets `mapType="none"`, and uses `UrlTile` to display Geoapify/OpenStreetMap raster tiles. The mobile client requests `/api/v1/map/tiles/:z/:x/:y`; the backend proxies Geoapify and keeps `GEOAPIFY_API_KEY` server-side. No Geoapify key, Google Cloud configuration, or Google Maps API key is present in the mobile client.

iOS remains unchanged on Apple Maps. Physical Android testing passed with the fallback, and markers, current location, filters, reports, nearby support places, routing, and Get Directions remain available.
