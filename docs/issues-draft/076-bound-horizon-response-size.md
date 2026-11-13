# Bound the Horizon Response Size Before Parsing

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 4

## Problem statement

`getJson` parses whatever Horizon returns with no size limit and no content-type check (`server/stellar-verification.ts:136-140`, the `await response.json()` call inside `getJson`), and the operations-loading loop in `checkTransaction` reads `result.data?._embedded?.records` without confirming it is an array (`server/stellar-verification.ts:240-242`). Because the Horizon base URL is operator-configurable (`server/stellar-verification.ts:42-58`, the `horizonUrl` function), a misconfigured or compromised endpoint (or a redirect to a large resource) can force the serverless function to buffer and parse an arbitrarily large body, risking memory exhaustion. Affected: operators of the API under a bad Horizon configuration.

## Technical implementation requirements

- Reject responses whose size exceeds a fixed, conservative limit before full parsing, returning `pending` with a safe reason by reusing the existing unreadable-response branch.
- Validate that `_embedded.records` is an array before iterating; if it is not, return `pending` rather than throwing.
- Keep the 10-second timeout and read-only GET behaviour, and leave normal response handling unchanged.
- Do NOT weaken the HTTPS validation in `horizonUrl` and do not add a dependency.

## Files and areas to touch

- `server/stellar-verification.ts`
- `tests/backend.test.ts`

## Dependencies

- None. Boundary with "Lock Down Horizon Failure-State Contracts" (which locks the malformed-response contract): this issue adds a size guard and an array-shape guard to `getJson` and the page loader, with its own tests; "Lock Down Horizon Failure-State Contracts" enforces no size limit.

## Measurable acceptance criteria

- A test in `tests/backend.test.ts` mocks `fetch` with a body larger than the configured limit and asserts the read path returns `{ status: 'pending' }` without buffering the whole body (a named oversized-body assertion, e.g. `getJson` bails on the size guard).
- A test mocks `fetch` with `{ _embedded: { records: 'not-an-array' } }` and asserts the loader returns `status: 'pending'` instead of throwing.
- A test with a valid `_embedded.records` array returns the same `Verification` object as the current behaviour (the pre-existing Horizon assertions in `tests/backend.test.ts` pass unchanged).
- `npm test -- tests/backend.test.ts` and `npm run typecheck` exit 0.

## Expected deliverables

- A size guard and an array-shape guard in the Horizon read path, plus mocked tests for oversized and malformed-shape responses.

## How to set up and run tests

- To skip database integration locally, set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty in the shell, then run `npm test -- tests/backend.test.ts`; the Horizon tests use a mocked `fetch`.
- Run `npm run typecheck`.

## Out of scope

- Streaming or pagination redesign, changing Horizon URLs, or altering the failure-state mapping covered by "Lock Down Horizon Failure-State Contracts".

## Suggested labels

- `area: backend`, `area: security`, `type: enhancement`, `difficulty: medium`.
