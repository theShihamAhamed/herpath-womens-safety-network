# HerPath Accessibility and Usability Baseline

Accessibility is part of each feature's definition of done, not final polish.

## Inclusive design

Implementations should accommodate younger and older adults, varying digital confidence, larger text, color-vision differences, motor limitations, screen readers, stressful contexts, and limited connectivity. Maintain specific research personas without claiming one persona represents everyone.

## Interaction and text

- Aim for touch targets of approximately 48 dp where practical, especially for important and icon-only controls.
- Test key screens with increased system font sizes.
- Do not allow important text to overlap, clip, or make actions unreachable.
- Use readable contrast; do not use coral/accent for small normal text on white without verification.
- Never communicate safety meaning using color alone. Pair color with a label, icon/symbol, and explanation.
- Important state changes must not depend only on motion or haptics.

## Forms

Shared controls should distinguish default, focused, error, disabled, filled, and submitting states where relevant. Labels remain visible, validation appears near the field, the keyboard does not cover the active field, forms remain scrollable with the keyboard open, and repeated submissions are prevented.

## Permissions and map alternatives

Request sensitive permissions in context. If location access is denied, explain the limitation, retain manual origin selection and non-location features, and provide a later retry path without repeated pressure.

Map pins must not be the only way to inspect incident information. Future implementations must provide an equivalent list or lower-panel representation and accessible marker labels where supported.

Incident reporting must offer manual exact-point selection and approximate-only area selection without forcing location permission. Approximate-area polygons require equivalent tappable text choices; selection state and severity must not rely on color alone. Submission state is announced, repeated taps are blocked, errors preserve the draft, and the multiline description remains reachable with the keyboard open.

### Incident Reporting interaction requirements

- Present visible **Step n of 3** text with progress semantics.
- Give category, severity, privacy mode, and accessible area choices radio roles, checked states, and visible selected indicators.
- Keep reporting controls approximately 48 dp where practical.
- Give every Review edit action a destination-specific accessible label and return directly to Review after the edit is completed.
- Show nearby validation only after an attempted invalid Continue, announce the first invalid group, and move accessibility focus there where supported.
- Keep the optional multiline description keyboard-safe, display its character count and identifying-information warning, and preserve large-text access to its remove action.
- Retain text alternatives to map-dependent location selection, including the approximate-area choices.
- Treat the privacy sheet as a modal reading surface: focus its heading on open, allow scrolling at large text sizes, respect safe areas, and restore focus to the invoking trigger after close where supported.
- Dragging must not be required to close the privacy sheet. Equivalent dismissal methods are the labeled Close action, **Got it**, backdrop tap, and Android Back.

## Required states

Core screens must consider loading, success, empty, validation error, server error, offline, permission denied, partial data, and insufficient evidence. Failures must be clear and recoverable.

## Safety under stress

Use familiar words, shallow navigation, visible primary actions, confirmation for destructive actions, minimal modal interruption, and preserved context after recoverable errors.

## Test matrix

Before accepting a major screen, test normal and increased Android text sizes, one-handed use, keyboard-open behavior, slow/unavailable backend, denied permissions when applicable, empty data, and long realistic content. Where possible, also test TalkBack or another screen reader.

For Incident Reporting, manually verify on Android and iOS: exact current location, denied permission and retry, exact manual point, approximate-only with device permission off, absence of any permission prompt in approximate-only, selection through both polygon and accessible text choice, editable local date/time, all severity labels, 500-character description, keyboard behavior, offline/ambiguous submission retry, duplicate-tap prevention, confirmation actions, My Reports refresh/pagination/empty/error states, account/session ownership changes, increased text, and TalkBack/VoiceOver. Record device/OS/build and observed results; unchecked repository items are not evidence that a device test passed.

## Incident Reporting final manual verification matrix

The following checks are planned evidence, not recorded results. Capture device, OS, build, expected result, observed result, and pass/fail for every executed case.

### A. DETAILS

- Select each category and severity; confirm neither is preselected on a new draft.
- Confirm current local time is the default and date/time can be changed.
- Confirm description starts collapsed, expands with its identifying-information warning, clears through Remove details, enforces 500 characters, and remains keyboard-accessible.
- Attempt Continue with required values missing; confirm nearby error, announcement, and first-invalid-group focus.

### B. LOCATION — exact current

- Confirm no permission request occurs before **Use my current location**.
- Test permission allow and deny paths.
- Confirm denial cannot submit a fallback/display coordinate.

### C. LOCATION — exact manual

- Select a manual point without granting or requesting device-location permission.
- Confirm the chosen point remains private in Review and owner history.

### D. LOCATION — approximate

- Confirm there is no location permission request or GPS acquisition.
- Load cells, test an oversized viewport, select through both polygon and accessible text choice, and confirm the selected state.

### E. Privacy sheet

- Open from DETAILS and LOCATION.
- Test downward drag dismissal, insufficient-drag return, backdrop, Close, **Got it**, and Android Back.
- Test large-text scrolling, heading focus, trigger-focus restoration, and repeated open/close with draft values unchanged.

### F. REVIEW

- Change incident details, occurrence time, location, and optional details.
- Confirm each edit returns directly to Review and preserves unrelated values.

### G. Submission

- Verify 201 creation, 200 idempotent replay, network failure, ambiguous retry, conflict, quota handling, and duplicate-tap prevention.
- Confirm recoverable errors preserve the draft and UUID.

### H. Confirmation

- Verify Return to Map, View My Reports, and Report another incident.
- Confirm Report another incident creates a fresh draft UUID.

### I. My Reports

- Verify loading, empty, retry, refresh, pagination, previous-state restoration, and absence of private coordinates or internal IDs.

### J. Map integration

- After a successful report, return to Map and verify focus refresh.
- When viewport and filters match, verify the public report, approximate-area polygon, coarse marker, occurrence time, and community-support wording.

### K. Accessibility

- Test Android and iOS large text, TalkBack, VoiceOver, touch targets, radio selected states, focus order, validation errors, and every privacy-sheet interaction.

Do not mark TalkBack, VoiceOver, or device behavior complete from source inspection alone.

## User Experience Engineering evidence plan

Interaction-count baselines are engineering measurements, not usability-study findings:

- Before: 8 numbered screens; approximately 12 in-app taps for exact-current and 13 for approximate reporting.
- After: 3 numbered stages; approximately 7 in-app taps for exact-current and 8 for approximate reporting.

Prepare the following evidence without fabricating participant outcomes:

1. Before/after task-flow diagrams.
2. Before screenshots of standalone Privacy, Category, and Location privacy; after screenshots of DETAILS, LOCATION, REVIEW, and the privacy sheet.
3. Short recordings of approximate and exact-current happy paths plus Review direct editing.
4. Large-text screenshots, privacy-sheet non-drag alternatives, and TalkBack/VoiceOver traversal notes after manual testing.
5. Task scenarios:
   - Report an incident that happened yesterday using an approximate area.
   - Deny location permission and report using manual exact selection.
   - Review a report, correct the occurrence time, and submit it.
6. For real participant tests, collect task completion, completion time, wrong taps, backtracking, hesitation, and help requested.
7. Ask after each task:
   - What location information will other users see?
   - Did the app request device location when choosing an approximate area?
   - Where would you change when the incident happened?
   - What does “unverified community report” mean to you?
   - Was anything unnecessary, confusing, difficult to find, or difficult to use?
