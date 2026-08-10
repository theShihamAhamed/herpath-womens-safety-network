# Security and Privacy Baseline

## Highly sensitive
- raw journey points
- private incident coordinates
- auth/session secrets

## Mandatory controls
- HTTPS in deployed environments
- never log raw tokens
- never expose private incident coordinates publicly
- never expose raw journey paths publicly
- validate all API input
- backend authorization for protected actions
- rate limiting for auth/report abuse
- stop location collection when journey ends/cancels/expires
- TTL/retention for raw journey data
- demo/test data excluded from real statistics
- audit moderator actions

Frontend `EXPO_PUBLIC_*` values are visible in the client bundle and must not contain secrets.
