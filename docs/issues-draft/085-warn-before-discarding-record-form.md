# Warn before discarding unsaved record-form input

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 5 hours

**Release day:** Day 4

## Problem statement

The disbursement dialog (the `{showForm && (` backdrop rendering
`<form className="form modal-large" onSubmit={saveRecord}>`, `src/App.tsx:1726-1734`) is closed whenever the
user cancels or clicks outside it, with no check for modified fields. The form is only cleared after a
successful save (`src/App.tsx:663-673`) and the backdrop closes it unconditionally on overlay click
(`src/App.tsx:1730-1732`, the `onMouseDown` handler), so there is no dirty-state guard. Because the form holds
several fields (recipient, address, purpose, amount, hash, note — initialised at `src/App.tsx:243-246`), a user
who has typed a full record and then clicks Cancel or the overlay loses all input silently. Affected:
organization and admin users entering disbursements.

## Technical implementation requirements

- Track whether the form differs from its initial value (compare against the reset literal in `saveRecord`
  at `src/App.tsx:664-673`).
- On every close path (the Cancel button `src/App.tsx:1886-1888`, the backdrop `onMouseDown` handler
  `src/App.tsx:1730-1732`, and the "Close form" button `src/App.tsx:1744-1751`), if the form is dirty,
  require a confirmation before closing; if it is untouched, close immediately.
- Do not prompt after a successful save (the reset already happened) and do not block the
  post-save close.
- Keep the existing submit-time validation in `saveRecord` (`src/App.tsx:633-649`) unchanged.

## Files and areas to touch

- `src/App.tsx`

## Dependencies

- None. Distinct from the record-form error-association accessibility draft, which concerns how
  field errors are announced, not how unsaved input is protected.

## Measurable acceptance criteria

- Typing into any field and clicking Cancel (or the backdrop) triggers a confirmation; confirming closes the
  dialog, and cancelling keeps `showForm` true together with the typed values.
- Opening the form and closing it without edits closes immediately with no confirmation (asserted in a
  component test if the dirty check is extracted).
- After a successful `saveRecord`, the dialog closes with no confirmation prompt.
- `npm run typecheck` and `npm test` exit 0.

## Expected deliverables

- Dirty-state tracking and a close-confirmation path for the record form dialog.

## How to set up and run tests

- Run `npm run dev`, connect an organization/admin wallet, open "Add record", type a value, try to
  close, and verify the prompt; then save a record and verify the dialog closes cleanly.

## Out of scope

- Draft persistence to storage, autosave, and any change to server-side record validation.

## Suggested labels

- `area: frontend`, `type: enhancement`, `difficulty: medium`
