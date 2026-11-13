<!-- OVERLAP: Sub-task of open issue #23 "Accessibility Pass". Narrowed to light-theme muted-text contrast only. -->

# Raise the Contrast of Muted Secondary Text

**Complexity:** Beginner (Trivial, 100 pts)

**Estimated effort:** 3 hours

**Release day:** Day 3

## Problem statement

The light theme's `--muted` token is `#7d8493` (`src/index.css:9`, the light-theme `--muted` custom
property) on a `--surface` of `#fff`
(`src/index.css:13`), a contrast ratio of about 3.75:1. It is used for small text throughout: table
headers at 9px (`src/index.css:416-424`, the `th` rule), summary labels (`332-337`, the
`.summary-grid article span, .summary-grid article small` rule; `347-350`, the
`.summary-grid article small` rule), the `.muted` class
(`511-514`), panel footers (`556-563`, the `.panel-foot` rule), and the empty state
(`523-540`, the `.empty-state` rule). All of these fall below the
4.5:1 minimum for normal text, and the `.brand small` tagline at `#9a9eaa`/8px
(`src/index.css:92-99`) is lower still, so low-vision users cannot reliably read secondary labels. The
dark theme's `--muted`
`#a7afc0` on `#171a29` already passes, so the fix is scoped to light mode.

## Technical implementation requirements

- Darken the light-theme `--muted` (and the `#9a9eaa` brand tagline) until body text reaches at least
  4.5:1 against the surfaces it is used on, without changing the brand palette for primary actions.
- Confirm the adjusted token still meets contrast on both `#fff` and the tinted panel and summary
  backgrounds.
- Leave the dark-theme tokens and `--purple`/`--mint`/status colours unchanged unless they also fail.
- Do not change component markup or class names.

## Files and areas to touch

- `src/index.css`
- `docs/manual-test-checklist.md`

## Dependencies

- None.

## Measurable acceptance criteria

- For each light-mode selector that uses `--muted` (`th`, `.summary-grid article span`,
  `.summary-grid article small`, `.muted`, `.panel-foot`, `.empty-state`) and for `.brand small`, the
  computed text color against its actual background measures at least 4.5:1.
- The deliverable records the measured before/after ratio for each selector (for example `--muted` on
  `#fff` moves from ≈3.75:1 to ≥4.5:1).
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` exit with code 0.

## Expected deliverables

- Updated token values and a short list of measured before/after ratios.

## How to set up and run tests

- Run `npm run dev` and measure the updated colours with a contrast checker such as the browser
  DevTools colour picker or the WebAIM contrast checker.
- Run `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build`.

## Out of scope

- Rebranding, dark-theme changes, non-text contrast (borders/icons), or the status badge palette.

## Suggested labels

- `area: accessibility`, `type: bug`, `difficulty: trivial`.
