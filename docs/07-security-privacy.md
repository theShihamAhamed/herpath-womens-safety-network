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
