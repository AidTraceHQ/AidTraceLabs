# Add a Skip-to-Content Link for Keyboard Users

**Complexity:** trivial

## Context

Partly a sub-task of open issue "Accessibility Pass". This draft is narrowed to the skip-to-content link only.

The layout in `src/App.tsx` renders a top bar (lines 925–981), then the tab bar (lines 1041–1072), and only then `<main>` (line 983). A keyboard or switch user must Tab through every top-bar control and every tab before reaching page content, and there is no bypass mechanism: no skip link, no jump target, and no `tabIndex` anywhere in the component (confirmed by reading `src/App.tsx`). Affected: keyboard-only, screen-reader, and motor-impaired users on every page (WCAG 2.4.1 Bypass Blocks).

## Acceptance criteria

- On first Tab from the page body, the skip link becomes visible and focused.
- Pressing Enter moves focus to the `<main>` region, and the next Tab continues inside the main content rather than restarting at the top bar.
- With keyboard focus elsewhere the link is not visible and does not consume layout space.
- `npm run lint`, `npm run typecheck`, and `npm run build` pass.

## Files to touch

- `src/App.tsx`
- `src/index.css`
- `docs/manual-test-checklist.md` (keyboard section)

## Test expectations

- Manual: run `npm run dev`, load the app, press Tab once; confirm the link appears, then press Enter and confirm focus lands in the main region.
- Run: `npm run typecheck`, `npm run lint`, `npm run format:check`

## Out of scope

Landmark restructuring, ARIA tablist conversion, or the broader accessibility pass tracked by the separate open issue.

## Depends on

None
