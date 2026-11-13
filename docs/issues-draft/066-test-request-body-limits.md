# Test Request Body Size and Malformed-JSON Handling

**Complexity:** Beginner (Trivial, 100 pts)

**Estimated effort:** 3 hours

**Release day:** Day 4

## Problem statement

The JSON body parser caps payloads at 32 kb and rejects malformed JSON (`server/app.ts:16`), and the error handler maps an oversized body to 413 and malformed JSON to 400 (`server/app.ts:28-41`). The malformed-JSON path is tested (`tests/backend.test.ts:61-67`), but the `entity.too.large` branch (`server/app.ts:33-41`) is never exercised, so a regression in the size cap would not fail the suite. Affected: the API's resistance to oversized-payload abuse.

## Technical implementation requirements

- Add a test posting a body over 32 kb to a JSON route and assert 413 with `{ "error": "Request body is too large." }`.
- Add a test posting a small valid body and assert it is not rejected with 413.
- Keep the existing malformed-JSON (400) assertion.
- Do NOT raise the limit, switch parsers, or change the error response shapes.

## Files and areas to touch

- `tests/backend.test.ts`

## Dependencies

- None for the oversized/malformed cases (rejected before routing); the small-body case may need a database.

## Measurable acceptance criteria

- An oversized body returns 413 with the documented message; malformed JSON returns 400.
- A normal small body is not rejected with 413.
- `npm test -- tests/backend.test.ts` passes; `npm run typecheck` passes.

## Expected deliverables

- Body-limit and malformed-body tests.

## How to set up and run tests

- For the parser-only cases, run with `TEST_DATABASE_URL` empty (PowerShell: `$env:TEST_DATABASE_URL=''; $env:TEST_DATABASE_URL_UNPOOLED=''`), then `npm test -- tests/backend.test.ts`.
- Run `npm run typecheck`.

## Out of scope

- Streaming/partial uploads, larger limits, or new content types.

## Suggested labels

- `area: security`, `area: testing`, `type: enhancement`, `difficulty: trivial`.
