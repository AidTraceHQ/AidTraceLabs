# Warn Before Discarding Unsaved Record-Form Input

**Complexity:** intermediate

## Context

The disbursement dialog in `src/App.tsx` (`{showForm && (` backdrop at lines 1726Ã¢â‚¬â€œ1734) is closed whenever the user cancels or clicks outside it, with no check for modified fields. The form is only cleared after a successful save (lines 663Ã¢â‚¬â€œ673), and the backdrop closes unconditionally on overlay click (lines 1730Ã¢â‚¬â€œ1732, the `onMouseDown` handler). A user who has typed a full record and then clicks Cancel or the overlay loses all input silently. Fields include recipient, address, purpose, amount, hash, and note Ã¢â‚¬â€ initialized at lines 243Ã¢â‚¬â€œ246. Affected: organization and admin users entering disbursements.

## Acceptance criteria

- Typing into any field and clicking Cancel (or the backdrop) triggers a confirmation; confirming closes the dialog, and cancelling keeps `showForm` true with the typed values intact.
- Opening the form and closing it without edits closes immediately with no confirmation prompt.
- After a successful `saveRecord`, the dialog closes with no confirmation prompt.
- `npm run typecheck` and `npm test` exit 0.

## Files to touch

- `src/App.tsx`

## Test expectations

- Manual: run `npm run dev`, connect an organization/admin wallet, open "Add record", type a value, try to close, and verify the prompt; then save a record and verify the dialog closes cleanly.
- Run: `npm run typecheck`
- Run: `npm test`

## Out of scope

Draft persistence to storage, autosave, and any change to server-side record validation.

## Depends on

None
