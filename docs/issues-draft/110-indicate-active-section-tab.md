# Indicate the Active Section in the Tab Bar

**Complexity:** trivial

## Context

Partly a sub-task of open issue "Accessibility Pass". This draft is narrowed to `aria-current` on the nav tabs only.

The section switcher in `src/App.tsx` (lines 1041–1072) is a `nav` of plain buttons whose active state is conveyed only by the `.active` CSS class (styled in `src/index.css`, lines 276–280). There is no `aria-current` or `aria-selected`, so a screen-reader user cannot tell which of "Public Transparency", "My Activity", "Beneficiary Records", or "Administration" is currently displayed. Affected: screen-reader users navigating the application.

## Acceptance criteria

- The selected section button exposes `aria-current="page"` and the others do not.
- Switching sections moves the attribute correctly.
- `npm run typecheck`, `npm run lint`, and `npm run build` pass.

## Files to touch

- `src/App.tsx`
- `docs/manual-test-checklist.md`

## Test expectations

- Manual: run `npm run dev`, inspect the tab buttons in DevTools, and confirm the attribute follows the active section.
- Run: `npm run typecheck`
- Run: `npm run lint`

## Out of scope

Restructuring the tabs into an ARIA tablist/tabpanel pattern or adding routes.

## Depends on

None
