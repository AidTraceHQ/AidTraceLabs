# Trap and Restore Focus in the Record and Disbursement Dialogs

**Complexity:** intermediate

## Context

> **Overlap note:** Sub-task of open issue "Accessibility Pass". Narrowed to dialog focus-trap only; keep as a standalone deliverable.

The record detail dialog and the new disbursement form render over the page but do not manage keyboard focus. The create form's backdrop in `src/App.tsx` (lines 1726Ã¢â‚¬â€œ1734) has only `role="presentation"` and no dialog semantics. The detail dialog (lines 1898Ã¢â‚¬â€œ1914) declares `role="dialog"` and `aria-modal="true"` but never moves focus into itself, traps Tab, closes on Escape, or restores focus to the row that opened it. Keyboard and screen-reader users can Tab into the obscured page behind the backdrop, and closing a dialog drops focus at the document body. Affected: keyboard-only and screen-reader users.

## Acceptance criteria

- Opening the "Add record" dialog moves `document.activeElement` inside the `.backdrop` element; pressing Tab 20 times keeps `document.activeElement` inside the dialog and never on a `.topbar` control or `.tab` button.
- Pressing Escape removes the dialog from the DOM and sets `document.activeElement` to the "Add record" button (line 1102) or the row's `View` button that opened it.
- While a dialog is open, the app container (`div.app`) carries `inert` (or `aria-hidden="true"`), and the attribute is removed when the dialog closes.
- The existing backdrop mouse-dismiss and both close buttons still close the dialog.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` exit with code 0.

## Files to touch

- `src/App.tsx`
- `src/index.css` (only if a focus style for the dialog container is required)
- `docs/manual-test-checklist.md`

## Test expectations

- Manual: run `npm run dev`, navigate the transparency table with Tab only, open a record, cycle focus, press Escape, and confirm focus returns to the `View` button. Repeat for "Add record".
- Run: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`

## Out of scope

Adding a custom focus-trap library, drag-to-move dialogs, or the field-error behavior tracked by "Associate Record-Form Validation Errors with Their Fields".

## Depends on

None
