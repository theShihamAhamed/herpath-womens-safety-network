# HerPath Content and Text Guidelines

HerPath language is calm, clear, actionable, privacy-conscious, and transparent about uncertainty. Avoid fear-inducing language, victim-blaming, jargon, sensational wording, and safety guarantees.

## Approved safety terminology

Use:

- Lower reported-risk
- Higher reported-risk
- Similar reported-risk
- Insufficient data
- Limited recent data
- Based on available community data
- Recent reports nearby
- Approximate public location

Never use:

- Safest route
- Safe route / Unsafe route
- Guaranteed safe
- Completely safe
- Danger-free
- Crime-free

## Map and location

- Primary search: **Where are you going?**
- Origin: **From**
- Destination: **To**
- Location fallback: **Choose starting point**
- Area section: **Area safety context**

Acceptable area messages include:

- No recent reports are visible in this area.
- Recent community reports are available for this area.
- There is limited recent data for this area.
- Adjust your filters to explore other reports.

Never interpret no reports as proof of safety.

Location context: **Use your location to show nearby safety information and start routes from where you are.** If access is denied: **Location access is off. You can still search and choose your starting point manually.** Keep manual selection available.

## Route comparison

Use relative, evidence-based language. Supporting explanations can describe fewer or several recent severe reports, community-data coverage, or limited recent data without exposing internal scoring coefficients. The journey action is **Start Journey**, never “Take safest route.”

## Incident reporting

Primary action: **Report an incident**.

Concise inline privacy reassurance: **Public map views always use an approximate area.** The progressive-disclosure action is **How location privacy works**.

The privacy sheet explains **Exact location privately**, **Approximate area**, **What’s public?**, and **What’s private?** in plain language. Public information is limited to the approximate area, category, severity, occurrence time, public report status, and community support. Private information includes the exact reporting location, reporter/account identity, description, and other private report details. It must explain that community support does not verify a report. Do not present internal location indexes, coordinates, storage field names, or geospatial implementation terminology as user-facing privacy copy.

Description helper: **Do not include names, phone numbers, addresses, or other information that could identify you or another person.**

The optional description begins collapsed when empty, has a 500-character limit, and provides a clear remove action after it is opened. Severity uses only the approved labels **Low**, **Medium**, **High**, and **Critical**; do not invent explanatory definitions for those labels.

Submission uses **Submit report** and success uses **Report submitted**. Do not imply immediate proof or verification.

Location choices are **Use exact location privately** and **Choose an approximate area**. Explain exact-private as **Your selected point is stored privately. HerPath publishes only an approximate area.** Explain approximate-only as **This map starts in Colombo for display only. It does not request or capture your device location.** Review must use short wording such as **Your exact location is stored privately. The public map shows only an approximate area.** or **Only the approximate area you selected is submitted.** Never show coordinates.

Confirmation identifies the submission as an **unverified community report** and says that only an approximate public location is visible. Map support counts use **community support**, never confirmation or verification.

## Safety Updates

- Screen title: **Safety Updates**
- Bell label: **Open safety updates**
- Empty state: **No new safety updates.**

Future update examples include nearby reports, route-information changes, journey reminders, and report-status updates. Routine updates must not use unnecessary emergency language.

## Journey

Before tracking, explain the location use and request explicit consent. Arrival requires the prompt **Have you arrived?** and the explicit action **I arrived safely** or **Report an incident**. Arrival must never automatically imply safety.

## States and errors

Use specific loading labels where useful, such as **Loading safety information…**, **Finding route options…**, **Submitting report…**, and **Restoring your session…**.

Errors must be plain and recoverable. Do not expose stack traces, database errors, API internals, filesystem paths, or status codes that do not help the user.

Icon-only controls require clear labels such as **Open safety updates**, **Use my current location**, **Open filters**, or **Go back**.
