# ADR-007: Community Verification Evidence

**Status:** Accepted
**Date:** 2026-08-25

## Context

HerPath needs community input about public incident reports without presenting votes as proof,
leaking actor identity, or coupling public visibility to evidence strength. Evidence also changes
with time, so persisted summaries need a deterministic and repeatable evaluation rule.

## Decision

Store community feedback as actor-private events in a dedicated Community Verification module.
Each authenticated actor may have one `ACTIVE` position per incident. Replacements supersede the
previous event, withdrawals preserve history, and actor-scoped UUIDv4 mutation IDs provide
idempotency.

The first algorithm is `BASELINE_V1`:

- every active response has baseline weight one;
- `SUPPORT`, `RESOLVED`, and `DISPUTE` are directional for 30 days;
- `UNSURE` is non-directional and contributes no evidence weight;
- `SUPPORTED` or `LIKELY_RESOLVED` requires matching weight at least three, at least two-thirds
  dominance, and opposing weight below two;
- `CONFLICTED` requires at least two response positions with weight two or greater;
- directional feedback that exists but has entirely expired produces `STALE`;
- all other insufficient evidence produces `UNVERIFIED`.

Persist one evidence snapshot per incident. Evaluation updates the snapshot and the Incident's
`communityState`, current `supportCount`, derived compatibility `status`, and lifecycle revision in
one MongoDB transaction. It never changes Incident visibility or moderation workflow.

Map and Routing continue to consume the Incident public reader. They do not read feedback storage
or learn actor identities. The verification API returns aggregate evidence only.

Age-based changes are handled by an explicit reconciliation command with aggregate-only dry-run
and apply modes. A scheduler is deferred.

## Consequences

- Community state remains explainable and deterministic but is evidence, not fact verification.
- Replacing or withdrawing feedback preserves a private audit trail without exposing actors.
- `supportCount` represents current contributing support, not lifetime popularity.
- Deployments performing feedback mutations require transaction-capable MongoDB.
- Process-local rate limiting is adequate for the current single-instance architecture and must use
  a shared store before multi-instance deployment.
- Later trust weighting, abuse flags, moderation cases, and scheduled reconciliation can extend the
  module without changing the public Incident contract.
