# Integration Checklist

## Foundation gate
- [ ] Expo moved to `frontend/`
- [ ] backend initialized
- [ ] docs committed
- [ ] `.github/` CI exists
- [ ] `develop` exists
- [ ] frontend installs/starts
- [ ] backend installs/starts
- [ ] `/api/v1/health` works
- [ ] no secrets tracked
- [ ] anonymous/pseudonymous auth contract works
- [ ] registered auth works
- [ ] moderator cannot self-assign role

## Incident → Map
- [ ] incident submission works
- [ ] private/public coordinates separated
- [ ] map endpoint exposes public location only
- [ ] newly submitted public incident can render

## Map/Incidents → Route
- [ ] route candidates available
- [ ] route corridor can query relevant incidents
- [ ] route uses approved terminology
- [ ] insufficient-data state works

## Route → Journey
- [ ] selected-route handoff contract stable
- [ ] journey can start from selected route
- [ ] tracking begins only after explicit consent

## Journey → Analytics
- [ ] safe requires explicit confirmation
- [ ] incident remains incident-affected after arrival
- [ ] unresolved becomes UNKNOWN
- [ ] route/area aggregates update
- [ ] test/demo journeys excluded

## Moderation
- [ ] moderation audit record created
- [ ] rejected/duplicate evidence is recalculated as designed
- [ ] concurrent moderator changes do not silently overwrite
