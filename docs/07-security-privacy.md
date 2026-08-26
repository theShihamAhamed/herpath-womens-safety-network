# Security and Privacy Baseline

## Highly sensitive
- raw journey points
- private incident coordinates
- auth/session secrets
- passwords and password hashes
- refresh-token hashes
- JWT signing secrets

## Mandatory controls
- HTTPS in deployed environments
- never log raw tokens
- never log passwords, password hashes, refresh-token hashes, or JWT signing secrets
- never expose private incident coordinates publicly
- never expose raw journey paths publicly
- validate all API input
- backend authorization for protected actions
- rate limiting for auth/report abuse
- stop location collection when journey ends/cancels/expires
- TTL/retention for raw journey data
- demo/test data excluded from real statistics
- audit moderator actions

## Incident location controls

- Exact location is collected only after the reporter chooses `EXACT_PRIVATE`; current-device location requires an explicit foreground-permission action and background location is not used.
- The exact Point is protected from default database selection and is never included in owner or public responses.
- `APPROXIMATE_ONLY` does not request permission, call GPS, import Map's fallback-location state, or submit a Point. It sends only a server-catalogued H3 resolution-8 cell ID and persists `privateLocation: null`.
- H3 conversion, cell validation, public center generation, and boundary generation are backend-owned.
- `publicCellId`, `reporterId`, and `clientSubmissionId` are protected internal fields. Descriptions and `locationMode` are owner-only.
- Public reads use an explicit status allowlist and an explicit projection. Coarsening reduces precision but is not an anonymity guarantee, especially with sparse reports, timestamps, text, or outside knowledge.
- Report logs must not include request bodies or coordinates. The configured HTTP serializer records request metadata, not body content.
- Actor-scoped idempotency and rate limiting reduce retry duplication and abuse. The current limiter is process-local and requires a shared store for multi-instance deployment.

## Authentication controls

- Registered passwords use Argon2id and are never returned by default database projections.
- Access tokens are signed, issuer/audience constrained, short-lived, and accepted only while their server-side session and user remain active.
- Refresh tokens use cryptographically secure randomness. The database stores SHA-256 hashes only.
- Refresh tokens rotate on use. Obvious reuse of a rotated token revokes active sessions for that user.
- Logout revokes its refresh session and is safe to repeat.
- Public input cannot assign roles or account status; moderator provisioning is an operator-only CLI action.
- Authentication errors do not reveal whether an email exists or whether an account is disabled.
- Authentication endpoints use stricter rate limits than general API traffic.
- Production startup rejects a missing or insufficiently strong access-token signing secret.

## Known assessed-project constraint

Registered passwords currently have a four-character minimum for demo usability. This is intentionally below normal production guidance and must be strengthened before treating the authentication policy as production-ready. Argon2id hashing, the 128-character maximum, rate limiting, and all session controls remain in force.

Frontend `EXPO_PUBLIC_*` values are visible in the client bundle and must not contain secrets.

## Mobile session storage

- Native Android/iOS stores only the opaque refresh token in Expo SecureStore.
- Access tokens and the safe actor projection remain in memory.
- Passwords, signing secrets, database credentials, and token logs are forbidden.
- Web refresh-token persistence is deferred beyond the first assessed milestone; there is no insecure storage fallback.
- Client route guards prevent normal navigation only. Every privileged backend operation must still authenticate and authorize the request.
- Device-specific API addresses belong in ignored local environment files, never source control.

## Community verification controls

- Every feedback route authenticates the actor server-side; actor IDs and evidence weights are
  never accepted from request bodies.
- Feedback actor IDs and client mutation IDs are excluded from default database selection and all
  public projections.
- Owners cannot provide feedback on their own reports. Only public incidents accept new or
  replacement feedback.
- Strict UUIDv4 idempotency, a 15-minute mutation cooldown, and a configurable actor quota limit
  accidental duplication and basic abuse. The quota is process-local and needs a shared store in a
  multi-instance deployment.
- Evidence is deliberately baseline-weighted; account type does not grant extra influence.
- Community state is evidence, not verification or truth. It cannot independently publish, hide,
  archive, or resolve moderation workflow.
- Feedback, evidence snapshot, and Incident compatibility updates use a MongoDB transaction.
- Verification responses expose only aggregate counts and state, never raw feedback or actor data.

## Moderation governance controls

### Authorization

- Authenticated users may submit abuse flags but cannot access moderation queue, case, action, or
  audit endpoints.
- Every moderation endpoint enforces the server-issued `MODERATOR` role. Frontend route guards are
  not an authorization boundary.
- Only the assigned moderator may release or decide an active case. A moderator cannot decide a
  case for an Incident they reported.

### Privacy

- Moderation API projections never expose reporter identity, flagger identity, private incident
  coordinates, tokens, session data, raw feedback events, individual responses, actor
  contributions, or evidence weights.
- Queue assignment is expressed relative to the requesting moderator; assigned moderator IDs are
  not response fields.
- Case detail contains only an Incident summary, aggregate flag counts, and aggregate community
  evidence. Audit history uses an explicit safe projection.
- Community evidence cannot independently hide, archive, publish, or prove an Incident. Only an
  explicit moderator decision changes visibility.

### Concurrency and idempotency

- Moderator mutations require an actor-scoped UUIDv4 `clientActionId`.
- `expectedCaseRevision` and `expectedLifecycleRevision` reject stale or competing actions with
  HTTP 409 rather than silently overwriting state.
- Exact action replays return the current safe case result without another mutation, revision, or
  audit entry. Reusing an action ID with changed intent returns `IDEMPOTENCY_CONFLICT`.

### Audit and atomicity

- Audit records are append-only; application persistence exposes create/list operations but no
  update, replace, or delete operation.
- Case workflow, Incident lifecycle, and audit writes commit in one MongoDB transaction.
- Failure to persist the audit rolls back case changes, visibility/moderation changes, and lifecycle
  revision increments.
- Conflicted-evidence reconciliation creates one system `CASE_QUEUED` audit per newly queued case,
  is idempotent, and never changes evidence, support count, or visibility.
