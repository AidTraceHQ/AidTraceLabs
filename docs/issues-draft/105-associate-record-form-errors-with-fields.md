# Associate Record-Form Validation Errors with Their Fields

**Complexity:** intermediate

## Context

> **Overlap note:** Sub-task of open issue "Accessibility Pass". Narrowed to form field-error association only.

`saveRecord` in `src/App.tsx` (function `saveRecord`, lines 633Ã¢â‚¬â€œ649) validates recipient, amount, address, and transaction hash and reports a single free-text error through the global alert (the `{error && (Ã¢â‚¬Â¦)}` `role="alert"` block at lines 1026Ã¢â‚¬â€œ1034). The offending inputs carry no `aria-invalid` and are not connected to the message, so a screen-reader user hears the error message with no indication of which field failed and focus is not moved to it. The void form has the same pattern (lines 697Ã¢â‚¬â€œ701, the empty-reason check in `voidRecord()`, with the reason `<textarea>` at lines 2129Ã¢â‚¬â€œ2138). Additionally, changing the `Asset` select mounts new inputs (lines 1810Ã¢â‚¬â€œ1833) without moving focus. Affected: screen-reader users submitting the disbursement form.

## Acceptance criteria

- Submitting the create form with a missing recipient sets `aria-invalid="true"` on that input, sets `aria-describedby` to the id of the adjacent message, and sets `document.activeElement` to the input.
- Each validation branch targets the matching field: empty recipient Ã¢â€ â€™ the recipient input; `amount=0` Ã¢â€ â€™ the amount input; invalid `recipientAddress` Ã¢â€ â€™ that input; a 63-character `txHash` Ã¢â€ â€™ the txHash input.
- Selecting "Other (enter asset code)" in the `Asset` select sets `document.activeElement` to the `Asset code` input.
- Submitting the void form with an empty reason sets `aria-invalid="true"` and an `aria-describedby` on the reason `<textarea>`.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` exit with code 0.

## Files to touch

- `src/App.tsx`
- `src/index.css` (error text styling only)
- `docs/manual-test-checklist.md`

## Test expectations

- Manual: run `npm run dev`, connect a wallet with record permissions, submit an empty create form, and confirm focus and error association for each failing field.
- Run: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`

## Out of scope

Server-side validation changes, adding a validation library, or the modal focus trap tracked by "Trap and Restore Focus in the Record and Disbursement Dialogs".

## Depends on

None
