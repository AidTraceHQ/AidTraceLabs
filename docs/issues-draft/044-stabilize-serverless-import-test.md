# Stabilize the Serverless Handler Import Test in the Full Suite

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 8 hours

**Release day:** Day 5

## Problem statement

The handler-export assertion imports `api/index.js` inside a test with a 30-second global timeout (`tests/serverless.test.ts:27-30`; `vitest.config.ts:9`). In the full current suite it timed out at 30s while 35/36 tests passed; the file passed 3/3 in isolation with a 90s timeout. This creates a load-sensitive CI failure rather than a deterministic assertion failure.

## Technical implementation requirements

- Reproduce under the full-suite worker configuration and profile the dynamic import path.
- Prefer reducing/restructuring avoidable module work or isolating the serverless test's worker cost.
- Do not raise the global timeout just to hide the failure; if a narrow timeout adjustment is necessary, justify it with measured isolated and full-suite durations.
- Keep the assertions that pool settings change under `VERCEL` and that the handler is callable.

## Files and areas to touch

- `tests/serverless.test.ts`
- `vitest.config.ts`
- `api/index.ts` or `server/app.ts` only if profiling identifies unnecessary import work

## Dependencies

- None. This is a unit-suite stability issue, not the Playwright journey in #21.

## Measurable acceptance criteria

- `npm test` passes repeatedly on a clean run without increasing every test's timeout.
- The serverless tests pass both alone and under the configured full-suite workers.
- Vercel-specific and non-Vercel pool assertions remain intact.

## Expected deliverables

- A measured root-cause note, narrowly scoped test/import improvement, and repeatable passing full-suite evidence.

## How to set up and run tests

- For a local run without database integration, set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty in the shell (PowerShell: `$env:TEST_DATABASE_URL=''; $env:TEST_DATABASE_URL_UNPOOLED=''`).
- Run `npm test` and `npx vitest run tests/serverless.test.ts`.

## Out of scope

- Raising all test timeouts, removing the serverless test, or changing Vercel runtime behavior.

## Suggested labels

- `area: testing`, `area: infrastructure`, `type: bug`, `difficulty: medium`.
