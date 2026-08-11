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
- [ ] restored sessions open the Map tab
- [ ] bottom navigation contains exactly Map, Report, and Profile
- [ ] Safety Updates opens from the accessible Map bell and can navigate back
- [ ] Routes and Alerts have no tab routes or hidden tab registrations
- [ ] shared shell remains usable with larger text and comfortable touch targets

## Incident → Map

- [ ] incident submission works
- [ ] private/public coordinates separated
- [ ] map endpoint exposes public location only
- [ ] newly submitted public incident can render

## Map/Incidents → Route

- [ ] Map consumes Routing only through its documented public feature exports
- [ ] destination search begins from the Map experience
- [ ] route candidates available
- [ ] route corridor can query relevant incidents
- [ ] route uses approved terminology
- [ ] insufficient-data state works
- [ ] no visible reports are never presented as proof of safety

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
