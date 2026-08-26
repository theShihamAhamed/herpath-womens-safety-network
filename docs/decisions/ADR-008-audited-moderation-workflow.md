# ADR-008: Audited Moderation Workflow and Governance Separation

**Status:** Accepted
**Date:** 2026-08-26

## Context

Incident Reporting publishes privacy-safe, unverified community reports immediately. Governance is
still required after submission so abuse reports and conflicting community evidence can receive
human review without treating a community signal as proof.

Community Verification evaluates aggregate evidence. It does not determine truth and cannot make
an incident public, hidden, or archived. Moderation owns human review, case workflow, and explicit
visibility decisions.

## Decision

Keep the three Incident lifecycle axes independent:

- Incident visibility: `PUBLIC`, `HIDDEN`, `ARCHIVED`
- Community Verification: `UNVERIFIED`, `SUPPORTED`, `CONFLICTED`, `LIKELY_RESOLVED`, `STALE`
- Moderation workflow: `NOT_QUEUED`, `QUEUED`, `IN_REVIEW`, `AWAITING_REPORTER`, `RESOLVED`

Community Verification owns feedback persistence, evidence evaluation, `communityState`, and the
current `supportCount`. A `CONFLICTED` incident in `NOT_QUEUED` may be reconciled into a moderation
case, but reconciliation does not alter evidence or visibility.

Moderation owns abuse-flag intake, cases, queue operations, human decisions, and audit history.
Cases currently implement `QUEUED`, `IN_REVIEW`, and `RESOLVED`; the Incident lifecycle retains
`AWAITING_REPORTER` for a future reporter-communication workflow, which is not exposed by the
current API.

Moderator decisions are `NO_ACTION`, `HIDE`, `RESTORE`, `ARCHIVE`, and `ARCHIVE_DUPLICATE`.
Visibility changes are planned through the Incident lifecycle transition service and committed in
the same MongoDB transaction as the case revision and append-only audit entry.

## Consequences

### Benefits

- Community evidence cannot automatically suppress a report.
- Private reporting data remains outside moderation queue, case, evidence, and audit projections.
- Every workflow action and visibility decision is auditable.
- Human oversight remains responsible for visibility decisions.
- Independent revisions prevent stale moderator actions from silently overwriting newer state.

### Tradeoffs

- Separate lifecycle axes, case revisions, transactions, and audit records add workflow complexity.
- The system requires moderator operations and transaction-capable MongoDB.
- Conflicted-evidence intake is an explicit command rather than a continuously scheduled process.

## Security principles

- Community signals never automatically hide, archive, publish, or prove an incident.
- Exact incident coordinates, reporter identity, flagger identity, and raw feedback never enter
  moderator API projections or audit history.
- Moderator actions require backend authentication and the `MODERATOR` role.
- Decisions require the assigned moderator and reject self-moderation.
- `expectedCaseRevision` and `expectedLifecycleRevision` protect workflow concurrency.
- Actor-scoped `clientActionId` values make moderator mutations idempotent.
- Audit history is append-only, and failed audit persistence rolls back the case and Incident
  lifecycle changes in the same transaction.
