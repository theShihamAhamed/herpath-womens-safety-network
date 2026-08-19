# HerPath Repository Documentation

This folder is the implementation baseline for **HerPath – Women's Safety Reporting & Safe-Route Network**.

Use these Markdown files during development so architecture, domain rules, API contracts, privacy rules, ownership boundaries, and integration assumptions remain traceable in Git.

## Reading order
1. `01-product-baseline.md`
2. `02-system-architecture.md`
3. `03-component-ownership.md`
4. `04-domain-rules.md`
5. `05-api-and-auth-contracts.md`
6. `06-navigation-and-flows.md`
7. `07-security-privacy.md`
8. `08-development-workflow.md`
9. `09-integration-checklist.md`
10. `ux/README.md` and the UX baseline documents it links
11. `decisions/ADR-004-primary-navigation-and-map-routing.md`
12. `decisions/ADR-005-incident-location-privacy.md`
13. `status/implementation-status.md`

## Change-control rule
If a PR changes an API, domain state, shared data contract, privacy or security rule, navigation contract, architecture, or cross-component behavior, update the relevant documentation in the same PR.

The implementation name is **HerPath**. Older planning documents may use the working name **SafeHer**.
