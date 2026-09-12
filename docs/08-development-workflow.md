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
