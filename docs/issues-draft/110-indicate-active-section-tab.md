<!-- OVERLAP: Sub-task of open issue #23 "Accessibility Pass". Narrowed to aria-current on the nav tabs only. -->

# Indicate the Active Section in the Tab Bar

**Complexity:** Beginner (Trivial, 100 pts)

**Estimated effort:** 3 hours

**Release day:** Day 5

## Problem statement

The section switcher is a `nav` of plain buttons whose active state is conveyed only by the `.active`
CSS class (`src/App.tsx:1041-1072`, `src/index.css:276-280`). There is no `aria-current` (or
`aria-selected`), so a screen-reader user cannot tell which of "Public Transparency", "My Activity",
"Beneficiary Records", or "Administration" is currently displayed.

## Technical implementation requirements

- Add `aria-current="page"` to the button for the currently selected `page` and omit it from the
  others.
- Keep the existing `.active` styling and the existing click handlers.
- Do not convert the buttons into a different control type or change the section content.

## Files and areas to touch

- `src/App.tsx`
- `docs/manual-test-checklist.md`

## Dependencies

- None.

## Measurable acceptance criteria

- The selected section button exposes `aria-current="page"` and the others do not.
- Switching sections moves the attribute correctly.
- `npm run typecheck`, `npm run lint`, and `npm run build` pass.

## Expected deliverables

- The `aria-current` binding and a checklist note.

## How to set up and run tests

- Run `npm run dev`, inspect the tab buttons in DevTools, and confirm the attribute follows the active
  section.
- Run `npm run typecheck` and `npm run lint`.

## Out of scope

- Restructuring the tabs into an ARIA tablist/tabpanel pattern or adding routes.

## Suggested labels

- `area: accessibility`, `type: enhancement`, `difficulty: trivial`.
