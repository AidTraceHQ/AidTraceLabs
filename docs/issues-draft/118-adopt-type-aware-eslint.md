# Adopt Type-Aware ESLint to Catch Floating Promises

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 14 hours

**Release day:** Day 2

## Problem statement

`eslint.config.js:7-29` extends `tseslint.configs.recommended` (`eslint.config.js:10`), which does **not**
enable the type-aware rules. The language options never set `parserOptions.project` or
`projectService` (`eslint.config.js:12-17`), so ESLint parses types syntactically only.

Consequently no floating (unawaited) promise is reported anywhere in the asynchronous code, and
`npm run lint` (`package.json:18`) passes with a dropped promise. This codebase is full of
promise-returning handlers whose result is not awaited — for example
`onClick={() => void loadTransparency()}` (`src/App.tsx:1088`), `onClick={() => void loadBenefit(…)}`
patterns, and `router.get('/api/me', …, (request, response) => retryReadOnlyDatabase(...))`
(`server/auth.ts:336-337`) — so a forgotten `await` would degrade into a silent unhandled rejection
rather than a lint error.

Affected: reviewers and maintainers; the reliability work in drafts "Handle Unhandled Rejections and Uncaught Exceptions" and "Abort Server-Side Horizon and Database Work When the Client Disconnects" has no lint guard, so
the same class of defect can be reintroduced after those fixes land.

## Technical implementation requirements

- Enable type-aware linting: add `projectService` (preferred, with a `tsconfig` covering `src/`,
  `server/`, `scripts/`, and `tests/`) and enable at least
  `@typescript-eslint/no-floating-promises` and `@typescript-eslint/no-misused-promises`.
- Enable `@typescript-eslint/no-unnecessary-condition` only if the resulting fixes stay mechanical;
  drop it if it produces churn unrelated to promise safety.
- Register `@typescript-eslint/await-thenable` and `@typescript-eslint/require-await` as errors if they
  can be satisfied without rewriting tests' intentional `async` signatures; otherwise document why a
  rule is excluded.
- Fix every reported violation in the repository, not just the new rules' first case. Prefer an
  explicit `void` with a comment for deliberately fire-and-forget UI handlers, and `await` for
  server-side work. Do not silence a violation with an inline disable unless the promise is genuinely
  intentional and the reason is written in the disable comment.
- Keep `eslint-config-prettier` last (`eslint.config.js:29`) and keep the existing ignores
  (`eslint.config.js:8`).
- Do not change runtime behaviour: no new retries, timeouts, or error handling are introduced by this
  issue beyond correcting a missing `await`.
- Do not upgrade ESLint or `typescript-eslint` major versions.

## Files and areas to touch

- `eslint.config.js`
- `tsconfig.json` / `tsconfig.server.json` / `tsconfig.test.json` (only if a combined project config is
  needed for `projectService`)
- `server/**/*.ts`, `scripts/**/*.ts`, `src/**/*.{ts,tsx}`, `tests/**/*.ts` (whatever types-aware lint
  flags)
- `.github/workflows/ci.yml` is unchanged; it already runs `npm run lint` (`ci.yml:51`)

## Dependencies

- Related to draft "Handle Unhandled Rejections and Uncaught Exceptions" (unhandled rejection/uncaught exception handling) and draft "Abort Server-Side Horizon and Database Work When the Client Disconnects" (abort server
  work on client disconnect). This issue adds the static guard; those issues change runtime behaviour.
  Sequence after them if they are in flight so violations are fixed once.

## Measurable acceptance criteria

- `npm run lint` uses type information: removing an `await` from a promise-returning call in a test patch
  produces a lint error.
- `no-floating-promises` and `no-misused-promises` are enabled and report zero violations across the
  repository.
- `npm run check` passes (typecheck, lint, format check, tests, smoke, build).
- Type-aware lint completes within the existing CI job without a hard timeout increase; if the runtime
  grows materially, document the measured duration in the pull request.

## Expected deliverables

- The type-aware ESLint configuration, the repository-wide fixes, and a short note in `CONTRIBUTING.md`
  describing that lint is type-aware and new code must not drop promises.

## How to set up and run tests

- `npm ci`
- `npm run lint` (should report and then, after fixes, pass with zero violations)
- `npm run check`
- Sanity check: temporarily delete an `await` in `server/records.ts` and confirm `npm run lint` fails.

## Out of scope

- Upgrading ESLint/`typescript-eslint`, adding formatting rules, adopting other lint plugins, or
  changing the test suite's behaviour.

## Suggested labels

- `area: infrastructure`, `type: enhancement`, `difficulty: high`.
