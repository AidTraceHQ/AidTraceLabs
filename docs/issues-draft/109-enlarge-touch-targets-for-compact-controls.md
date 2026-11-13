<!-- OVERLAP: Sub-task of open issue #23 "Accessibility Pass". Narrowed to touch-target sizing only. -->

# Enlarge Touch Targets for Compact Controls

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 5 hours

**Release day:** Day 4

## Problem statement

Several interactive controls are smaller than the 24x24 CSS-pixel minimum in WCAG 2.2 SC 2.5.8 and
well below the 44x44 size recommended for touch. The icon buttons are 34x34
(`src/index.css:164-173`, the `.icon-button` rule),
and the table `View`/`Remove` text buttons (`src/index.css:501-510`, the `.text-button` rule) and header sort buttons
(`src/index.css:447-455`, the `.sort-button` rule) use `padding: 0` with 9-10px text, rendering
roughly 14-18px tall. On touch
screens these targets are hard to hit accurately, especially in dense tables and the mobile tab row
(`.tab`, `src/index.css:1117-1120`).

## Technical implementation requirements

- Raise each interactive control to at least a 24x24 target, using padding or a `min-height`/
  `min-width` that does not break the desktop table density.
- Prioritise 44x44 for primary mobile controls; where a dense table makes that impractical, document
  the exception and keep at least the 24x24 minimum with adequate spacing.
- Increase the `.text-button`/`.sort-button` hit areas without changing their typography or the sort
  behaviour.
- Do not change component structure beyond what is needed for target size.

## Files and areas to touch

- `src/index.css`
- `docs/manual-test-checklist.md`

## Dependencies

- None.

## Measurable acceptance criteria

- At a 360px viewport, `.icon-button`, `.text-button`, `.sort-button`, `.tab`, `.explorer-link`, and
  every `<select>` report `getBoundingClientRect()` width `>= 24` and height `>= 24`.
- `.icon-button` and `.tab` report `>= 44` on both axes at 360px, or the deliverable lists each
  control that stays below 44x44 with a reason.
- `.text-button` (table `View`/`Remove`) and `.sort-button` report a measured height `>= 24` at 360px,
  up from the current 14-18px.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` exit with code 0.

## Expected deliverables

- Adjusted control sizing and a short list of measured targets.

## How to set up and run tests

- Run `npm run dev`, inspect each control's box with DevTools at desktop and 360px widths, and record
  the measured sizes.
- Run `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build`.

## Out of scope

- Redesigning the table layout, the responsive breakpoints, or non-interactive spacing.

## Suggested labels

- `area: accessibility`, `type: enhancement`, `difficulty: medium`.
