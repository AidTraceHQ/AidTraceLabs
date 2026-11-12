# Prevent Record-Form Changes During Submission

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 4

## Problem statement

While `saveRecord` is awaiting the API, inputs and close controls remain enabled; only the submit button is disabled (`src/App.tsx:627-668,1731-1889`). The success handler resets from the submitted render's captured form object, so edits made during the request can be silently discarded.

## Technical implementation requirements

- Make the submitted snapshot authoritative for the request.
- Disable or otherwise safely preserve form edits and close actions while submission is pending.
- Re-enable controls on failure and retain the user's submitted values for correction/retry.
- Do not change server validation or transaction semantics.

## Files and areas to touch

- `src/App.tsx`
- `docs/manual-test-checklist.md`

## Dependencies

- None.

## Measurable acceptance criteria

- A deferred API response cannot cause user-entered changes to disappear silently.
- Failure re-enables editing and preserves entered values.
- Success clears only the submitted form and cannot close/reopen into stale in-flight state.

## Expected deliverables

- Submission-state handling and a documented delayed-response manual regression case.

## How to set up and run tests

- In a browser, throttle `/api/records` to a delayed response, submit the form, and verify fields/close actions cannot discard the pending submission; repeat with a failed response and verify the submitted values remain editable.
- Run `npm run typecheck`, `npm run lint`, and `npm run build`.

## Out of scope

- Autosaving drafts, redesigning modal focus management, or changing the record API.

## Suggested labels

- `area: frontend`, `type: bug`, `difficulty: medium`.
