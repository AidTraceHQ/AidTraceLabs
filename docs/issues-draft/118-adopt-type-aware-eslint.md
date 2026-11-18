# Adopt Type-Aware ESLint to Catch Floating Promises

**Complexity:** advanced

## Context

`eslint.config.js` (lines 7Ã¢â‚¬â€œ29) extends `tseslint.configs.recommended` (line 10), which does not enable the type-aware rules. The language options never set `parserOptions.project` or `projectService` (lines 12Ã¢â‚¬â€œ17), so ESLint parses types syntactically only. No floating (unawaited) promise is reported anywhere in the asynchronous code, and `npm run lint` passes with a dropped promise. The codebase has promise-returning handlers not awaited Ã¢â‚¬â€ e.g. `onClick={() => void loadTransparency()}` in `src/App.tsx` (line 1088) and `router.get('/api/me', Ã¢â‚¬Â¦, retryReadOnlyDatabase(...))` in `server/auth.ts` (lines 336Ã¢â‚¬â€œ337) Ã¢â‚¬â€ so a forgotten `await` degrades into a silent unhandled rejection rather than a lint error. Affected: reviewers and maintainers; the reliability work in "Handle Unhandled Rejections and Uncaught Exceptions" and "Abort Server-Side Horizon and Database Work When the Client Disconnects" has no lint guard, so the same class of defect can be reintroduced.

## Acceptance criteria

- `npm run lint` uses type information: removing an `await` from a promise-returning call in a test patch produces a lint error.
- `no-floating-promises` and `no-misused-promises` are enabled and report zero violations across the repository.
- `npm run check` passes (typecheck, lint, format check, tests, smoke, build).
- Type-aware lint completes within the existing CI job without a hard timeout increase; if runtime grows materially, document the measured duration in the pull request.

## Files to touch

- `eslint.config.js`
- `tsconfig.json` / `tsconfig.server.json` / `tsconfig.test.json` (only if a combined project config is needed for `projectService`)
- `server/**/*.ts`, `scripts/**/*.ts`, `src/**/*.{ts,tsx}`, `tests/**/*.ts` (whatever type-aware lint flags)

## Test expectations

- Run: `npm ci`
- Run: `npm run lint` (should report then, after fixes, pass with zero violations)
- Run: `npm run check`
- Sanity check: temporarily delete an `await` in `server/records.ts` and confirm `npm run lint` fails.

## Out of scope

Upgrading ESLint/`typescript-eslint`, adding formatting rules, adopting other lint plugins, or changing the test suite's behavior.

## Depends on

Handle Unhandled Rejections and Uncaught Exceptions, Abort Server-Side Horizon and Database Work When the Client Disconnects
