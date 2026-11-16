# Test Request Body Size and Malformed-JSON Handling

**Complexity:** trivial

## Context

The JSON body parser caps payloads at 32 KB and rejects malformed JSON in `server/app.ts` (line 16), and the error handler maps oversized bodies to 413 and malformed JSON to 400 (lines 28–41). The malformed-JSON path is tested in `tests/backend.test.ts` (lines 61–67), but the `entity.too.large` branch (lines 33–41) is never exercised, so a regression in the size cap would not fail the suite. Affected: the API's resistance to oversized-payload abuse.

## Acceptance criteria

- A test posting a body over 32 KB to a JSON route returns 413 with `{ "error": "Request body is too large." }`.
- A test posting a small valid body asserts it is not rejected with 413.
- The existing malformed-JSON (400) assertion is kept.
- `npm test -- tests/backend.test.ts` passes; `npm run typecheck` passes.

## Files to touch

- `tests/backend.test.ts`

## Test expectations

- For the parser-only cases, set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty.
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

Streaming/partial uploads, larger limits, or new content types.

## Depends on

None
