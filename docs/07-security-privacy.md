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
