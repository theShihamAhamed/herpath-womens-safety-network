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

## Required states

Core screens must consider loading, success, empty, validation error, server error, offline, permission denied, partial data, and insufficient evidence. Failures must be clear and recoverable.

## Safety under stress

Use familiar words, shallow navigation, visible primary actions, confirmation for destructive actions, minimal modal interruption, and preserved context after recoverable errors.

## Test matrix

Before accepting a major screen, test normal and increased Android text sizes, one-handed use, keyboard-open behavior, slow/unavailable backend, denied permissions when applicable, empty data, and long realistic content. Where possible, also test TalkBack or another screen reader.

For Incident Reporting, manually verify on Android and iOS: exact current location, denied permission and retry, exact manual point, approximate-only with device permission off, absence of any permission prompt in approximate-only, selection through both polygon and accessible text choice, editable local date/time, all severity labels, 500-character description, keyboard behavior, offline/ambiguous submission retry, duplicate-tap prevention, confirmation actions, My Reports refresh/pagination/empty/error states, account/session ownership changes, increased text, and TalkBack/VoiceOver. Record device/OS/build and observed results; unchecked repository items are not evidence that a device test passed.
