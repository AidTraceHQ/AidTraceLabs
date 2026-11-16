# Prevent Record-Form Changes During Submission

**Complexity:** medium

## Context

While the `saveRecord` handler in `src/App.tsx` (function `saveRecord`, lines 627–668) awaits the API, inputs and close controls in the "New disbursement" modal (`<form className="form modal-large">` at lines 1731–1889) remain enabled; only the submit button is disabled. The success handler resets from the submitted snapshot, so edits made during the request can be silently discarded. Affected users: organization and admin users who edit form fields while a save is in progress. Current behavior: form inputs and cancel/close controls remain interactive during submission; mid-flight edits are silently dropped on success. Expected behavior: the submitted snapshot is authoritative; controls are disabled or preserve edits during submission; on failure, submitted values remain for correction.

## Acceptance criteria

- With `/api/records` throttled to a delayed response, the form inputs and the Cancel/close controls cannot discard the pending submission (disabled or edits preserved); documented in `docs/manual-test-checklist.md`.
- After a failed response the controls are re-enabled and the entered values remain editable.
- On success only the submitted snapshot is cleared.
- `npm run typecheck`, `npm run lint`, and `npm run build` pass.

## Files to touch

- `src/App.tsx`
- `docs/manual-test-checklist.md`

## Test expectations

- Manual: throttle `/api/records` to a delayed response, submit the form, verify fields/close cannot discard the pending submission; then repeat with a failed response and verify submitted values remain editable.
- Run: `npm run typecheck`, `npm run lint`, `npm run build`

## Out of scope

Autosaving drafts, redesigning modal focus management, or changing the record API.

## Depends on

None
