# Enlarge Touch Targets for Compact Controls

**Complexity:** medium

## Context

Partly a sub-task of open issue "Accessibility Pass". This draft is narrowed to touch-target sizing only.

Several interactive controls are smaller than the 24×24 CSS-pixel minimum in WCAG 2.2 SC 2.5.8 and well below the 44×44 size recommended for touch. The icon buttons are 34×34 in `src/index.css` (the `.icon-button` rule at lines 164–173). The table `View`/`Remove` text buttons (the `.text-button` rule at lines 501–510) and header sort buttons (the `.sort-button` rule at lines 447–455) use `padding: 0` with 9–10px text, rendering roughly 14–18px tall. On touch screens these targets are hard to hit accurately in dense tables and the mobile tab row (`.tab`, lines 1117–1120). Affected: touch-screen users across all interactive controls.

## Acceptance criteria

- At a 360px viewport, `.icon-button`, `.text-button`, `.sort-button`, `.tab`, `.explorer-link`, and every `<select>` report `getBoundingClientRect()` width `>= 24` and height `>= 24`.
- `.icon-button` and `.tab` report `>= 44` on both axes at 360px, or the deliverable lists each control that stays below 44×44 with a reason.
- `.text-button` and `.sort-button` report a measured height `>= 24` at 360px, up from the current 14–18px.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` exit with code 0.

## Files to touch

- `src/index.css`
- `docs/manual-test-checklist.md`

## Test expectations

- Manual: run `npm run dev`, inspect each control's box with DevTools at desktop and 360px widths, and record measured sizes.
- Run: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`

## Out of scope

Redesigning the table layout, the responsive breakpoints, or non-interactive spacing.

## Depends on

None
