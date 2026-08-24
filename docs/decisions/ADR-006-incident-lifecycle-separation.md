# ADR-006: Incident Lifecycle Separation

**Status:** Accepted

## Context

Incident reports are published immediately as unverified community reports. The original `status`
field combined public visibility, community evidence, and moderator workflow into one value. Those
concerns change independently: a report can remain public while receiving community support or
entering moderator review, and community evidence does not establish truth.

## Decision

The Incident model stores three independent server-controlled lifecycle axes:

- `visibilityState`: `PUBLIC`, `HIDDEN`, or `ARCHIVED`. This alone controls public availability.
- `communityState`: `UNVERIFIED`, `SUPPORTED`, `CONFLICTED`, `LIKELY_RESOLVED`, or `STALE`.
  It summarizes community evidence and never proves or verifies an incident.
- `moderationState`: `NOT_QUEUED`, `QUEUED`, `IN_REVIEW`, `AWAITING_REPORTER`, or `RESOLVED`.
  It records workflow progress and does not itself control public availability.

`lifecycleRevision` starts at zero and advances when a lifecycle transition changes state. It is the
foundation for later concurrency checks.

New reports default to `PUBLIC`, `UNVERIFIED`, `NOT_QUEUED`, and revision zero. They therefore
remain immediately public.

### Compatibility status

The existing `status` and `supportCount` fields remain temporarily so current Incident, Map, and
Routing consumers continue to work. `status` is a derived compatibility projection with this
precedence:

```text
ARCHIVED
HIDDEN
moderation RESOLVED
community CONFLICTED
community SUPPORTED
PUBLISHED_UNVERIFIED
```

Current owner and public API response shapes are unchanged and do not expose lifecycle fields.
Public Incident reads use `visibilityState = PUBLIC`. During migration, a document remains publicly
readable only when all lifecycle fields are absent and its legacy status is
`PUBLISHED_UNVERIFIED`. Partially migrated records fail closed.

### Migration

The lifecycle backfill supports dry-run, apply, and restricted rollback modes. Apply fills only
missing lifecycle fields, preserves existing report data and timestamps, and stops when legacy
records have unexpected statuses or invalid lifecycle values. Rollback removes only unchanged
default lifecycle fields at revision zero; progressed records remain untouched.

## Consequences

- Visibility, evidence, and moderation workflow can evolve without changing one another implicitly.
- Current Incident and Map contracts remain compatible while consumers move away from the legacy
  status field.
- Community evidence continues to be presented as evidence rather than truth or verification.
- Phase 1 creates no community-feedback, abuse-flagging, evidence-evaluation, moderation-case, or
  moderator API. Those capabilities belong to later phases.
