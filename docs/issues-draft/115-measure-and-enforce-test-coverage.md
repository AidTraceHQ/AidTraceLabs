# Measure and Enforce Test Coverage in CI

**Complexity:** intermediate

## Context

The suite runs in CI but nothing measures what it covers, so a change can silently drop coverage of a security or money-path module. `vitest.config.ts` (lines 3Ã¢â‚¬â€œ11) configures environment, include, setup files, and timeouts but no `coverage` block. `.github/workflows/ci.yml` (line 54) runs `npm test` with no coverage collection and no threshold gate. The Vitest coverage provider is not installed (`package.json`, lines 41Ã¢â‚¬â€œ65). Affected: maintainers who cannot see whether a pull request reduced protection of `server/auth.ts`, `server/records.ts`, or `server/stellar-verification.ts`.

## Acceptance criteria

- `npm run test:coverage` prints a coverage summary and exits non-zero when a configured threshold is missed.
- The committed thresholds pass on `main` at the measured baseline.
- CI runs the coverage gate; a deliberately uncovered new branch in `server/auth.ts` under the per-file floor fails the job.
- `npm test` still runs the suite without coverage overhead.
- `npm run typecheck` and `npm run lint` pass.

## Files to touch

- `vitest.config.ts`
- `package.json` / `package-lock.json`
- `.github/workflows/ci.yml`
- `CONTRIBUTING.md` (checks list)

## Test expectations

- Run: `npm ci && npm run test:coverage` (requires `TEST_DATABASE_URL` for database-backed files)
- Temporarily raise a threshold above the measured value and confirm the command fails.
- Run: `npm run typecheck`, `npm run lint`

## Out of scope

Adding new tests for unrelated features, coverage badges, Codecov/other SaaS integration, mutation testing, and changing the existing test include globs.

## Depends on

None
