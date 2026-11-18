# Bound the Horizon Response Size Before Parsing

**Complexity:** intermediate

## Context

`getJson` in `server/stellar-verification.ts` (lines 136Ã¢â‚¬â€œ140, the `await response.json()` call) parses whatever Horizon returns with no size limit and no content-type check. The operations-loading loop in `checkTransaction` reads `result.data?._embedded?.records` without confirming it is an array (lines 240Ã¢â‚¬â€œ242). Because the Horizon base URL is operator-configurable (function `horizonUrl`, lines 42Ã¢â‚¬â€œ58), a misconfigured or compromised endpoint or redirect to a large resource can force the serverless function to buffer and parse an arbitrarily large body. Affected: operators of the API under a bad Horizon configuration. This adds a size guard and an array-shape guard; it does not overlap with the failure-state contract tests in "Lock Down Horizon Failure-State Contracts".

## Acceptance criteria

- A test mocks `fetch` with a body larger than the configured limit and asserts the read path returns `{ status: 'pending' }` without buffering the whole body.
- A test mocks `fetch` with `{ _embedded: { records: 'not-an-array' } }` and asserts the loader returns `status: 'pending'` instead of throwing.
- A test with a valid `_embedded.records` array returns the same `Verification` object as the current behavior.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` exit 0.

## Files to touch

- `server/stellar-verification.ts`
- `tests/backend.test.ts`

## Test expectations

- Set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty; Horizon tests use mocked `fetch`.
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

Streaming or pagination redesign, changing Horizon URLs, or altering the failure-state mapping covered by "Lock Down Horizon Failure-State Contracts".

## Depends on

None
