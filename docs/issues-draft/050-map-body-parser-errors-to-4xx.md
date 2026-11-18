# Return 4xx for Unsupported Request Encodings

**Complexity:** beginner

## Context

The error handler in `server/app.ts` maps only malformed JSON (`SyntaxError`, lines 29Ã¢â‚¬â€œ32) and oversized bodies (`entity.too.large`, lines 33Ã¢â‚¬â€œ41) to client error responses. Every other body-parser error falls through to the generic 500 branch (lines 47Ã¢â‚¬â€œ52). The JSON parser is installed globally (`server/app.ts`, line 16) and rejects a body with an unsupported charset with an error carrying `type: 'charset.unsupported'` (status 415); an unsupported content-encoding yields `encoding.unsupported`. These client-caused conditions produce a misleading 500 today. Affected: API clients that send unusual but invalid content types. Current behavior: `Content-Type: application/json; charset=utf-16le` returns 500. Expected behavior: returns 415 with `{ "error": "..." }`.

## Acceptance criteria

- A request with `Content-Type: application/json; charset=utf-16le` returns 415, not 500.
- Malformed JSON still returns 400 and an oversized body still returns 413 with their existing messages.
- `npm test -- tests/backend.test.ts` passes and `npm run typecheck` passes.

## Files to touch

- `server/app.ts`
- `tests/backend.test.ts`

## Test expectations

- Set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty (rejected before routing).
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

Larger limits, streaming bodies, new content types, or changing JSON strictness.

## Depends on

None
