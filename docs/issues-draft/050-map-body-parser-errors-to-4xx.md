# Return 4xx for Unsupported Request Encodings

**Complexity:** Beginner (Trivial, 100 pts)

**Estimated effort:** 3 hours

**Release day:** Day 4

## Problem statement

The error handler maps only malformed JSON (`SyntaxError`, `server/app.ts:29-32`) and oversized bodies (`entity.too.large`, `server/app.ts:33-41`). Every other body-parser error falls through to the generic 500 branch (`server/app.ts:47-52`). The JSON parser is installed globally (`server/app.ts:16`) and rejects a body whose declared charset is unsupported with an error carrying `type: 'charset.unsupported'` (status 415); an unsupported content-encoding yields `encoding.unsupported`. The handler never inspects the error's `status`/`statusCode`, so these client-caused conditions produce a misleading 500. Affected: API clients that send unusual-but-invalid content types.

## Technical implementation requirements

- Map body-parser error `type` values for unsupported charset/encoding (and `entity.verify.failed` if present) to 4xx responses using the existing `{ "error": "..." }` shape.
- Prefer the error's own `status`/`statusCode` when it is a 4xx, defaulting to 415 for unsupported media/charset.
- Keep the existing 400 (malformed JSON) and 413 (too large) responses and messages unchanged.
- Do NOT change the 32 KB limit, switch parsers, or add new content types.

## Files and areas to touch

- `server/app.ts`
- `tests/backend.test.ts`

## Dependencies

- Distinct from the existing draft that tests the current 400/413 body paths; this adds new mappings rather than asserting the existing ones.

## Measurable acceptance criteria

- A request with `Content-Type: application/json; charset=utf-16le` returns 415, not 500.
- Malformed JSON still returns 400 and an oversized body still returns 413 with their existing messages.
- `npm test -- tests/backend.test.ts` passes and `npm run typecheck` passes.

## Expected deliverables

- Error-handler branch for unsupported encodings and a test asserting 415.

## How to set up and run tests

- These paths are rejected before routing; run with `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty (PowerShell: `$env:TEST_DATABASE_URL=''; $env:TEST_DATABASE_URL_UNPOOLED=''`), then `npm test -- tests/backend.test.ts`.
- Run `npm run typecheck`.

## Out of scope

- Larger limits, streaming bodies, new content types, or changing JSON-strictness.

## Suggested labels

- `area: backend`, `type: bug`, `difficulty: trivial`
