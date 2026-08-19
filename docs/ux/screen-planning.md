# HerPath Screen Planning Baseline

Feature owners may refine visuals during implementation, but must preserve this information hierarchy and interaction intent unless usability findings justify a documented change.

## Map / Home

Map is the default HerPath workspace. The initial shell contains:

```text
HerPath                         bell
Where are you going?
Map / geographic content
Area safety context
Future route-results location
Map | Report | Profile
```

Do not place a large permanent route form on the initial view.

Implementation must eventually consider loading, location permission states, GPS/backend/network failures, offline use, no reports, limited data, route-search/results states, large text, and screen readers.

## Route Planning inside Map

The entry is **Where are you going?**. Route search uses familiar **From** and **To** labels and defaults From to current location only when permission and location are available. Manual origin selection remains usable otherwise.

Route results should stay visually connected to Map through a lower panel or equivalent integration surface. Each alternative should eventually provide time, distance, a relative reported-risk label, evidence/data-coverage context, and **Start Journey**. Never claim that a route is guaranteed safe.

Users should understand the evidence behind comparisons in plain language. Internal coefficients and weights do not belong in normal user-facing views.

## Report

Report remains a primary tab. The implemented staged screen covers privacy explanation, category, location privacy choice, location selection, editable date/time, severity, optional description, review, submission, confirmation, and My Reports.

**Use exact location privately** allows either an explicit one-time current-location request or a manual map tap. **Choose an approximate area** starts from a display-only region, never requests device location, and requires the user to pan/zoom, load server-generated areas, and select one. Review shows the privacy mode but no coordinates or H3 identifiers. Recoverable submission failures preserve the draft and retry UUID.

## Safety Updates

Safety Updates opens from the Map bell and provides a native back path. The foundation state is **No new safety updates.** Future updates may deep-link to incident, area, route, journey, or account destinations, but delivery infrastructure is separate work.

## Profile

Anonymous profiles continue to expose Sign In and Create Account. Registered profiles show account identity, history/settings entry points when implemented, and Log Out. Moderator entry is visible only to moderator actors. Frontend guards do not replace backend authorization.

## Active Journey

Active Journey is a focused nested flow:

```text
selected route → tracking explanation → explicit consent → active journey
→ progress/check-ins → arrival detected → explicit outcome confirmation
```

Arrival does not mean safety. The user must explicitly choose **I arrived safely** or report an incident/issue.

## Moderator

Moderator UX should prioritize queue context, privacy risk, duplicate evidence, history, clear decisions, required reasons, concurrency feedback, and audit confirmation. It must not expose infrastructure or operator secrets.
