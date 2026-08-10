# API and Authentication Contracts

## API prefix
`/api/v1`

## Response envelopes
Success:
```json
{"success": true, "data": {}, "meta": {}}
```

Error:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": []
  },
  "requestId": "..."
}
```

## Foundation endpoints
```text
GET  /api/v1/health
POST /api/v1/auth/anonymous
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

## Authentication endpoint contracts

All request bodies are strict: unknown properties are rejected. Public registration cannot set `role`, `status`, or privileges.

| Endpoint | Request | Success | Authentication |
| --- | --- | --- | --- |
| `POST /auth/anonymous` | No body (`{}` is also accepted) | HTTP 201 token bundle and anonymous user | None |
| `POST /auth/register` | `{ name, email, password }` | HTTP 201 token bundle and registered user | None |
| `POST /auth/login` | `{ email, password }` | HTTP 200 token bundle and registered user | None |
| `POST /auth/refresh` | `{ refreshToken }` | HTTP 200 rotated token bundle and user | Refresh token |
| `POST /auth/logout` | `{ refreshToken }` | HTTP 200 `{ loggedOut: true }` | Refresh token; idempotent |
| `GET /auth/me` | None | HTTP 200 `{ user }` | Bearer access token |

A token bundle contains `accessToken`, `refreshToken`, `tokenType: "Bearer"`, `expiresIn` (seconds), and a safe `user` projection. Password hashes and refresh-token hashes are never response fields. Login failures use the same response for an unknown email, incorrect password, or disabled account.

## User and session model

Users have these server-controlled classifications:

- `accountType`: `ANONYMOUS` or `REGISTERED`
- `role`: `USER` or `MODERATOR`
- `status`: `ACTIVE` or `DISABLED`

Anonymous users have no name, email, password, or public identity. The anonymous endpoint accepts a request with no body; if a body is supplied, it must be an empty object because unknown fields are rejected. Registered email addresses are trimmed, lowercased, and unique. Registered passwords must contain 4 to 128 characters and are stored only as Argon2id hashes.

Access JWTs are short-lived and contain only `sub`, `role`, `sid`, `iss`, `aud`, `iat`, and `exp`. Refresh tokens are opaque random values. Only their SHA-256 hashes are stored. Refreshing rotates the token and session; reuse of an already rotated token revokes the active session chain. Logout revokes the matching session.

The anonymous, registration, login, and refresh endpoints have a stricter auth-specific rate limit in addition to the API-wide limit.

## Anonymous/pseudonymous identity
Anonymous reporting and anonymous journeys still need server-side ownership, rate limiting, and secure linking. Therefore anonymous access is represented by a pseudonymous backend session/account rather than only a frontend boolean.

It may own:
- anonymous reports
- journeys
- permitted community actions

Its identity is never displayed publicly.

## Registered users
Public registration always creates a normal user role server-side. The client cannot choose moderator/admin roles.

## Moderator
Provision an existing active registered account through the restricted operator command `npm run user:promote -- <registered-email>`. No public moderator-signup route exists.

## Token baseline
- short-lived access token
- revocable refresh/session token
- backend role authorization
- secure native storage for refresh/session secret
- frontend route guards are UX, not security boundaries

Native Android is the first assessed platform. Full authenticated web support can be deferred unless explicitly required.

## Mobile session contract

The Expo client keeps access tokens and the current actor in memory. On native platforms it persists only the refresh token through Expo SecureStore. Startup rotates any stored refresh token and verifies the actor through `/auth/me`; otherwise it creates an anonymous session. Invalid or revoked stored tokens are removed before creating a replacement anonymous identity.

Sign-in and registration replace the anonymous session. Logout attempts server revocation, clears local session material, then creates a fresh anonymous session. The client never derives moderator status locally; route visibility uses the role returned by the backend.
