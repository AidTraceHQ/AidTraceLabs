# Stabilize the Serverless Handler Import Test in the Full Suite

**Complexity:** medium

## Context

The handler-export assertion in `tests/serverless.test.ts` (lines 27–30) imports `api/index.js` inside a test with a 30-second global timeout (`vitest.config.ts`, line 9). In the full suite the test timed out at 30s while 35/36 other tests passed; the file passed 3/3 in isolation with a 90s timeout. This creates a load-sensitive CI failure rather than a deterministic assertion failure. Affected users: CI and contributors running the full test suite. Current behavior: the serverless test passes in isolation but times out under full-suite worker load. Expected behavior: the test passes reliably in the full suite without raising the global timeout; the assertions that pool settings change under `VERCEL` and that the handler is callable are preserved.

## Acceptance criteria

- `npm test` passes repeatedly on a clean run without increasing every test's timeout.
- The serverless tests pass both alone and under the configured full-suite workers.
- Vercel-specific and non-Vercel pool assertions remain intact.

## Files to touch

- `tests/serverless.test.ts`
- `vitest.config.ts`
- `api/index.ts` or `server/app.ts` (only if profiling identifies unnecessary import work)

## Test expectations

- Set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty to skip database integration.
- Run: `npm test` (full suite)
- Run: `npx vitest run tests/serverless.test.ts` (isolated)

## Out of scope

Raising all test timeouts, removing the serverless test, or changing Vercel runtime behavior.

## Depends on

None
