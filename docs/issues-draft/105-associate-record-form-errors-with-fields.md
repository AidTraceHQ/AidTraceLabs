<!-- OVERLAP: Sub-task of open issue #23 "Accessibility Pass". Narrowed to form field-error association only. -->

# Associate Record-Form Validation Errors with Their Fields

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 7 hours

**Release day:** Day 2

## Problem statement

`saveRecord` validates recipient, amount, address, and transaction hash and reports a single
free-text error through the global alert (`src/App.tsx:633-649`, the validation branches in
`saveRecord()`, rendered by the `{error && (…)}` `role="alert"` block at `src/App.tsx:1026-1034`). The
offending inputs carry no `aria-invalid` and are not connected to the message, so a screen-reader
user hears "Enter a recipient, purpose and positive amount." with no indication of which field
failed, and focus is not moved to it. The void form has the same pattern (`src/App.tsx:697-701`, the
empty-reason check in `voidRecord()`,
with the reason `<textarea>` at `src/App.tsx:2129-2138`). Additionally, changing the `Asset` select mounts new inputs
(`src/App.tsx:1810-1833`, the conditional `Asset code` and `Asset issuer` `<label>` blocks) without
moving focus, which disorients keyboard users.

## Technical implementation requirements

- Track per-field validity for the create form and the inline edit form and set `aria-invalid` on the
  invalid control.
- Connect each control to its error text with `aria-describedby` and render the message adjacent to
  the field.
- On a failed submit, move focus to the first invalid field.
- Keep the summary alert (`role="alert"`) as an at-a-glance message and avoid duplicate
  announcements.
- When the conditional asset inputs mount, place focus on the newly revealed field.
- Do not change server validation rules, field names, or payloads.

## Files and areas to touch

- `src/App.tsx`
- `src/index.css` (error text styling only)
- `docs/manual-test-checklist.md`

## Dependencies

- None.

## Measurable acceptance criteria

- Submitting the create form with a missing recipient sets `aria-invalid="true"` on that input, sets
  `aria-describedby` to the id of the adjacent message, and sets `document.activeElement` to the
  input.
- Each validation branch targets the matching field: empty recipient → the recipient input;
  `amount=0` → the amount input; invalid `recipientAddress` → that input; a 63-character `txHash` →
  the txHash input.
- Selecting `Other (enter asset code)` in the `Asset` select sets `document.activeElement` to the
  `Asset code` input.
- Submitting the void form with an empty reason sets `aria-invalid="true"` and an `aria-describedby`
  on the reason `<textarea>`.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` exit with code 0.

## Expected deliverables

- Field-level validation wiring, adjacent error text, focus handling, and checklist updates.

## How to set up and run tests

- Run `npm run dev`, connect a wallet with record permissions, submit an empty create form, and
  confirm focus and error association for each failing field.
- Run `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build`.

## Out of scope

- Server-side validation changes, adding a validation library, or the modal focus trap tracked
  separately.

## Suggested labels

- `area: accessibility`, `type: enhancement`, `difficulty: medium`.
