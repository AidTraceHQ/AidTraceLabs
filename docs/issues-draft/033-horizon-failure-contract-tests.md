# Lock Down Horizon Failure-State Contracts

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 8 hours

**Release day:** Day 3

## Problem statement

`checkTransaction` has distinct branches for thrown fetch errors, unreadable/non-2xx transaction responses, unknown transaction success, operation endpoint errors, malformed operation bodies, missing paging cursors, and explicitly unsuccessful transactions (`server/stellar-verification.ts:145-280`). Existing tests exercise success, mismatch, strict-send, not-found, and paging budget, but not the complete transport failure contract (`tests/backend.test.ts:80-286`).

## Technical implementation requirements

- Add one focused verification failure-contract suite using mocked `fetch` responses.
- Assert the existing intended mapping for timeout/network error, malformed JSON, 429/5xx, missing success flag, operation failure, missing cursor, and unsuccessful transaction.
- Keep production verification logic unchanged unless a test demonstrates behavior contradicting the documented pending/not-found/mismatch semantics; any change must be narrowly specified.

## Files and areas to touch

- `tests/backend.test.ts`
- `server/stellar-verification.ts` only if a contract defect is demonstrated
- `docs/backend-design.md` if response-state wording changes

## Dependencies

- None. This is separate from #17's multi-operation transaction cases.

## Measurable acceptance criteria

- Each listed Horizon failure shape has an assertion for status and user-safe reason.
- No transport failure is reported as `verified`.
- Tests do not call live Horizon or require a wallet/database credential.

## Expected deliverables

- Deterministic failure-path verification tests and, only if needed, a narrowly scoped behavior correction.

## How to set up and run tests

- To skip database integration locally, set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty in the shell, then run `npm test -- tests/backend.test.ts`; the Horizon tests use mocked `fetch`.
- Run `npm run typecheck`.

## Out of scope

- Multi-operation algorithm changes, scheduled reverification (#18), or new payment operation support.

## Suggested labels

- `area: backend`, `area: testing`, `type: enhancement`, `difficulty: medium`.
