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

## Incident reporting endpoints

All Incident routes require a Bearer access token. Anonymous and registered actors use the same backend-owned `request.auth.userId`; clients cannot supply a reporter ID. Request bodies and query objects are strict and reject unknown properties.

### `POST /api/v1/incidents`

Creates an owner-scoped report. A new report returns HTTP 201. An identical idempotent replay returns the existing owner projection with HTTP 200. Reusing the same `clientSubmissionId` for different normalized content returns HTTP 409 `IDEMPOTENCY_CONFLICT`.

Shared request fields:

```json
{
  "clientSubmissionId": "6ba7b810-9dad-4f71-80b4-00c04fd430c8",
  "category": "HARASSMENT",
  "severity": "HIGH",
  "occurredAt": "2026-08-18T20:15:00+05:30",
  "description": "Optional non-identifying description"
}
```

`clientSubmissionId` must be UUIDv4. `occurredAt` must include `Z` or an explicit numeric offset and cannot exceed the server clock by more than five minutes. `description` is trimmed, optional, and limited to 500 characters.

Exact-private location:

```json
{
  "location": {
    "mode": "EXACT_PRIVATE",
    "privateLocation": {
      "type": "Point",
      "coordinates": [79.8612, 6.9271]
    }
  }
}
```

Approximate-only location:

```json
{
  "location": {
    "mode": "APPROXIMATE_ONLY",
    "selectedAreaCellId": "88644d9659fffff"
  }
}
```

The cell ID must be an H3 resolution-8 cell supplied by the location-cell catalog. Approximate-only requests contain no Point. Server-controlled reporter, status, support count, timestamps, `visibilityState`, `communityState`, `moderationState`, `lifecycleRevision`, `publicCellId`, `publicLocation`, and `publicArea` fields are rejected if added to the body.

The owner response contains:

```text
id, category, severity, status, occurredAt, createdAt, supportCount,
locationMode, optional description
```

It never returns coordinates or an H3 cell ID. The default new-report limit is five distinct submission IDs per authenticated actor per 15 minutes. Existing idempotent replays are resolved before that quota is consumed.

The returned `status` is a derived compatibility projection. The three lifecycle axes and
`lifecycleRevision` are internal and are not added to the owner response in Phase 1.

### `GET /api/v1/incidents/location-cells`

Returns selectable public areas for approximate-only reporting. Required query parameters are `north`, `south`, `east`, and `west`. Latitude and longitude spans must each be at most 0.1 degrees, wrapped viewports are rejected, and no more than 200 cells are returned.

Each item contains `cellId`, `publicLocation`, and `publicArea`. The Point is the representative H3 center and the Polygon contains a closed GeoJSON ring.

### `GET /api/v1/incidents/mine`

Returns only reports owned by the authenticated actor, newest submission first. `limit` defaults to 20 and must be 1-50. `cursor` is an opaque continuation value. The response data is `{ items, nextCursor }` using the owner projection above.

Anonymous reports remain with the pseudonymous account/session that created them; sign-in, registration, or logout does not silently transfer ownership.

## Public Map incident endpoints

`GET /api/v1/map/incidents` accepts required `swLat`, `swLng`, `neLat`, `neLng`, with optional `category`, `severity`, `occurredFrom`, and `occurredTo`. `GET /api/v1/map/area-summary` accepts `lat`, `lng`, optional `radius` from 100 to 10,000 metres, and optional `occurredFrom`/`occurredTo`. Time bounds are inclusive absolute instants and require `Z` or an explicit numeric offset.

Each public incident contains only:

```text
id, category, severity, status, occurredAt, createdAt, supportCount,
publicLocation, publicArea
```

It never contains `privateLocation`, `reporterId`, `locationMode`, `publicCellId`, `clientSubmissionId`, `description`, `visibilityState`, `communityState`, `moderationState`, `lifecycleRevision`, or account/session data. V1 uses the H3 center for viewport/radius inclusion and supports non-wrapping viewports only.

Public availability is controlled by `visibilityState`, not the compatibility `status`. During the
backfill period, a legacy document is eligible only when all lifecycle fields are absent and its
status is `PUBLISHED_UNVERIFIED`. Community and moderation APIs do not exist in Phase 1; later
phases will add feedback, flags, evidence evaluation, and moderation cases without changing the
current reporting endpoints in this foundation.
