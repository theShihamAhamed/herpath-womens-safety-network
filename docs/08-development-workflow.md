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

On Android Expo Go, the UI, API features, and support-place data can work while the native map surface remains black and tiles do not render. Repository inspection found valid MapView dimensions, the default Android provider, and no custom style or tile layer; this is an observed SDK 57 Expo Go testing limitation, not proof that HerPath map logic is broken.

Do not add Google Maps keys, Google Cloud billing/configuration, or MapView workarounds without team approval. If native Android verification is required, use an approved development-build workflow, configure any required Android credentials only after approval, and test the same map there before changing application map logic.
