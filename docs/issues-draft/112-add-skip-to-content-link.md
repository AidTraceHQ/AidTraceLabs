<!-- OVERLAP: Sub-task of open issue #23 "Accessibility Pass". Narrowed to skip-to-content link only. -->

# Add a Skip-to-Content Link for Keyboard Users

**Complexity:** Beginner (Trivial, 100 pts)

**Estimated effort:** 3 hours

**Release day:** Day 3

## Problem statement

The layout renders a top bar with brand, network picker, theme toggle, and wallet controls
(`src/App.tsx:925-981`), then the tab bar (`src/App.tsx:1041-1072`), and only then `<main>`
(`src/App.tsx:983`). A keyboard or switch user must Tab through every top-bar control and every tab
before reaching page content, and there is no bypass mechanism: no `skip link`, no jump target, and no
`tabIndex` anywhere in the component (confirmed by reading `src/App.tsx`).

Affected: keyboard-only, screen-reader, and motor-impaired users on every page, which is exactly the
audience WCAG 2.4.1 (Bypass Blocks) protects.

## Technical implementation requirements

- Add a skip link as the first focusable element in the rendered app, before the top bar
  (`src/App.tsx:925`).
- The link must be visually hidden until focused, then visible with the existing focus treatment
  (`src/index.css:40-47` defines the `:focus-visible` outline; reuse that instead of inventing new
  colors).
- Give `<main>` (`src/App.tsx:983`) an `id` and point the link's `href` at it (`#main-content`).
- Keep the link's text explicit, for example "Skip to main content".
- Do not add a router, do not reorder the existing sections, and do not change the tab behaviour.
- Add the off-screen-but-focusable utility style to `src/index.css`; do not use `display: none` or
  `visibility: hidden`, which remove the link from the tab order.

## Files and areas to touch

- `src/App.tsx`
- `src/index.css`
- `docs/manual-test-checklist.md` (keyboard section)

## Dependencies

- None. Complements draft "Trap and Restore Focus in the Record and Disbursement Dialogs" (dialog focus trapping) and draft "Indicate the Active Section in the Tab Bar" (`aria-current` on tabs); those
  change different elements, so the three must not be merged into one change.

## Measurable acceptance criteria

- On first Tab from the page body, the skip link becomes visible and focused.
- Pressing Enter moves focus to the `<main>` region, and the next Tab continues inside the main
  content rather than restarting at the top bar.
- With keyboard focus elsewhere the link is not visible and does not consume layout space.
- `npm run lint`, `npm run typecheck`, and `npm run build` pass.

## Expected deliverables

- The skip link, its styles, and a manual-test-checklist entry.

## How to set up and run tests

- Run `npm run dev`, load the app, and press Tab once; confirm the link appears, then press Enter and
  confirm focus lands in the main region.
- Run `npm run typecheck`, `npm run lint`, `npm run format:check`.

## Out of scope

- Landmark restructuring, ARIA tablist conversion, or the broader accessibility pass tracked by the
  existing accessibility issue.

## Suggested labels

- `area: accessibility`, `type: enhancement`, `difficulty: trivial`.
