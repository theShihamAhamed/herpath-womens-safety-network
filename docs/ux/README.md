# HerPath UX Baseline

This directory is the approved shared user-experience and information-architecture baseline for HerPath. Read it before implementing Map, Routing, Incident Reporting, Journey, Safety Updates, or shared navigation work.

## Reading order

1. `information-architecture.md`
2. `screen-planning.md`
3. `content-and-text-guidelines.md`
4. `accessibility-and-usability.md`
5. `alerts-planning.md`
6. `development-integration-guide.md`
7. `usability-test-plan.md`

## Scope

The persistent navigation is:

```text
Map | Report | Profile
```

Routing is presented inside the Map experience while remaining a separately owned technical feature. Safety Updates and Active Journey are nested screens rather than permanent tabs.

This baseline does not itself authorize implementation of map providers, place or route providers, route-risk scoring, incident submission, journey tracking, notification delivery, moderation, or analytics.

## Change control

Changes to navigation, safety terminology, accessibility requirements, shared screen behavior, ownership boundaries, or cross-feature integration must update these documents and the relevant architecture documentation in the same PR.
