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

## Required states

Core screens must consider loading, success, empty, validation error, server error, offline, permission denied, partial data, and insufficient evidence. Failures must be clear and recoverable.

## Safety under stress

Use familiar words, shallow navigation, visible primary actions, confirmation for destructive actions, minimal modal interruption, and preserved context after recoverable errors.

## Test matrix

Before accepting a major screen, test normal and increased Android text sizes, one-handed use, keyboard-open behavior, slow/unavailable backend, denied permissions when applicable, empty data, and long realistic content. Where possible, also test TalkBack or another screen reader.
