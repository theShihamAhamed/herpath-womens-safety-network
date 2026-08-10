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
Provision through a restricted development/operator CLI or administrative process. No public moderator-signup route.

## Token baseline
- short-lived access token
- revocable refresh/session token
- backend role authorization
- secure native storage for refresh/session secret
- frontend route guards are UX, not security boundaries

Native Android is the first assessed platform. Full authenticated web support can be deferred unless explicitly required.
