# Raise the Contrast of Muted Secondary Text

> **Status:** Dropped - merged into #23

**Complexity:** trivial

## Context

Partly a sub-task of open issue "Accessibility Pass". This draft is narrowed to light-theme muted-text contrast only.

The light theme's `--muted` token is `#7d8493` in `src/index.css` (line 9) on a `--surface` of `#fff` (line 13), a contrast ratio of about 3.75:1. It is used for small text throughout: table headers at 9px (the `th` rule at lines 416–424), summary labels (lines 332–337 and 347–350), the `.muted` class (lines 511–514), panel footers (lines 556–563), and the empty state (lines 523–540). All of these fall below the 4.5:1 minimum for normal text. The `.brand small` tagline at `#9a9eaa`/8px (lines 92–99) is lower still. The dark theme's `--muted` `#a7afc0` on `#171a29` already passes, so the fix is scoped to light mode only. Affected: low-vision users who cannot reliably read secondary labels.

## Acceptance criteria

- For each light-mode selector that uses `--muted` (`th`, `.summary-grid article span`, `.summary-grid article small`, `.muted`, `.panel-foot`, `.empty-state`) and for `.brand small`, the computed text color against its actual background measures at least 4.5:1.
- The deliverable records the measured before/after ratio for each selector (e.g. `--muted` on `#fff` moves from ≈3.75:1 to ≥4.5:1).
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` exit with code 0.

## Files to touch

- `src/index.css`
- `docs/manual-test-checklist.md`

## Test expectations

- Manual: run `npm run dev` and measure updated colours with a contrast checker (browser DevTools colour picker or WebAIM contrast checker).
- Run: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`

## Out of scope

Rebranding, dark-theme changes, non-text contrast (borders/icons), or the status badge palette.

## Depends on

None
