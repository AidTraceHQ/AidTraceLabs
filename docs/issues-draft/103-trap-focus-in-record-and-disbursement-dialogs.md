<!-- OVERLAP: Sub-task of open issue #23 "Accessibility Pass". Narrowed to dialog focus-trap only; keep distinct from the broader pass. -->

# Trap and Restore Focus in the Record and Disbursement Dialogs

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 7 hours

**Release day:** Day 1

## Problem statement

The record detail dialog and the new disbursement form render over the page but do not manage keyboard
focus. The create form's backdrop has only `role="presentation"` and no dialog semantics
(`src/App.tsx:1726-1734`, the `{showForm && (…)}` create-form `.backdrop`), while the detail dialog
declares `role="dialog"` and `aria-modal="true"`
but never moves focus into itself, traps Tab, closes on Escape, or restores focus to the row that
opened it (`src/App.tsx:1898-1914`, the `{selected && (…)}` detail `.backdrop` and its
`<section className="form detail-modal modal-large" role="dialog">`). Keyboard and screen-reader users
can Tab into the obscured page
behind the backdrop, and closing a dialog drops focus at the document body. There is no key handler
or focus call anywhere in the component (confirmed by reading `src/App.tsx`).

## Technical implementation requirements

- Give both dialogs `role="dialog"`, `aria-modal="true"`, and an `aria-labelledby` pointing at their
  visible headings; the `New disbursement` heading (`src/App.tsx:1738`, the `<h2>New disbursement</h2>`)
  needs an `id`.
- Move focus to the first meaningful control (or the heading) when a dialog opens.
- Trap Tab and Shift+Tab within the open dialog so background content is unreachable.
- Close the top-most dialog on Escape, mirroring the existing backdrop `onMouseDown` dismiss.
- Restore focus to the element that opened the dialog (the `View` or `Add record` button) on close.
- Hide the background from assistive tech while a dialog is open (for example `inert` or
  `aria-hidden` on the app container) and restore it on close.
- Keep the existing close buttons, backdrop click-to-close, and the `role="alert"` conflict notice
  unchanged.

## Files and areas to touch

- `src/App.tsx`
- `src/index.css` (only if a focus style for the dialog container is required)
- `docs/manual-test-checklist.md`

## Dependencies

- None.

## Measurable acceptance criteria

- Opening the `Add record` dialog moves `document.activeElement` inside the `.backdrop` element;
  pressing Tab 20 times keeps `document.activeElement` inside the dialog and never on a `.topbar`
  control or `.tab` button.
- Pressing Escape removes the dialog from the DOM and sets `document.activeElement` to the `Add record`
  button (`src/App.tsx:1102`) or the row's `View` button that opened it.
- While a dialog is open, the app container (`div.app`) carries `inert` (or `aria-hidden="true"`), and
  the attribute is removed when the dialog closes.
- The existing backdrop mouse-dismiss and both close buttons still close the dialog.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` exit with code 0.

## Expected deliverables

- Focus management for both dialogs and a keyboard section in the manual test checklist.

## How to set up and run tests

- Run `npm run dev`, navigate the transparency table with Tab only, open a record, cycle focus, press
  Escape, and confirm focus lands back on the `View` button.
- Repeat for `Add record`; confirm the first field receives focus and the page behind is not tabbable.
- Run `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build`.

## Out of scope

- Adding a custom focus-trap library, drag-to-move dialogs, or the field-error behaviour tracked by
  the form-validation issue.

## Suggested labels

- `area: accessibility`, `type: enhancement`, `difficulty: medium`.
