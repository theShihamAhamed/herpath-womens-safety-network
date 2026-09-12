# ADR-001: Repository Layout

**Status:** Accepted baseline

Use one Git repository with two independent npm projects:
```text
frontend/
backend/
```
Store implementation documentation in `docs/`.

Do not add Nx, Turborepo, pnpm/yarn workspaces, or unnecessary orchestration for the initial assessed implementation.
