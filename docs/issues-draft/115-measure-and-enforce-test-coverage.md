# Measure and Enforce Test Coverage in CI

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 8 hours

**Release day:** Day 1

## Problem statement

The suite runs in CI but nothing measures what it covers, so a change can silently drop coverage of a
security or money-path module and still pass.

- `vitest.config.ts:3-11` configures environment, include, setup files, and timeouts but no
  `coverage` block.
- `.github/workflows/ci.yml:54` runs `npm test` (`vitest run`) with no coverage collection and no
  threshold gate; there is no coverage step anywhere in the workflow (`ci.yml:43-58`).
- The vitest coverage provider is not installed (`package.json:41-65` has no `@vitest/coverage-*`).

Affected: maintainers, who cannot see whether a pull request reduced protection of `server/auth.ts`,
`server/records.ts`, or `server/stellar-verification.ts`, and reviewers of the Drips backlog, who have
no baseline for "add tests" issues.

## Technical implementation requirements

- Add the matching Vitest coverage provider as a dev dependency and a `test:coverage` script
  (`package.json:6-24`); keep `npm test` behaviour unchanged for local runs.
- Configure coverage in `vitest.config.ts` with explicit `include` (the server and shared modules under
  test) and `exclude` (test files, `dist/`, `dist-server/`, migration SQL).
- Set thresholds in the config, not only in CI, so `npm run test:coverage` fails locally too: start
  with a `lines`/`statements` floor set to the measured current value, and add a per-file floor for
  `server/auth.ts` and `server/stellar-verification.ts` so the two highest-risk modules cannot silently
  regress.
- Add a CI step that runs the coverage script after `npm test` (`ci.yml:54`).
- Do not lower an existing test's assertions to satisfy the threshold; if a module is genuinely
  uncovered, add focused tests rather than excluding it.
- Do not add third-party coverage services, badges, or uploads.

## Files and areas to touch

- `vitest.config.ts`
- `package.json` / `package-lock.json`
- `.github/workflows/ci.yml`
- `CONTRIBUTING.md` (checks list, `CONTRIBUTING.md:31-39`)
- `docs/backlog-audit.md` is not touched; report the measured baseline in the pull request instead

## Dependencies

- None. Complements draft the new security-test drafts ("Test Database-Backed Per-Address Rate Limits" through "Test Pagination Cursor Integrity and Bounds") (new security tests): those add cases; this issue adds the gate and
  the measurement that makes their absence visible.

## Measurable acceptance criteria

- `npm run test:coverage` prints a coverage summary and exits non-zero when a configured threshold is
  missed.
- The committed thresholds pass on `main` at the measured baseline.
- CI runs the coverage gate; a deliberately uncovered new branch in `server/auth.ts` under the per-file
  floor fails the job.
- `npm test` still runs the suite without coverage overhead.
- `npm run typecheck` and `npm run lint` pass.

## Expected deliverables

- Coverage configuration with thresholds, a `test:coverage` script, a CI step, a `CONTRIBUTING.md`
  update, and the measured baseline recorded in the pull request.

## How to set up and run tests

- `npm ci`
- `npm run test:coverage` (requires `TEST_DATABASE_URL` for the database-backed files, as documented in
  `CONTRIBUTING.md:39`)
- Temporarily raise a threshold above the measured value and confirm the command fails.

## Out of scope

- Adding new tests for unrelated features, coverage badges, Codecov/other SaaS integration, mutation
  testing, and changing the existing test include globs.

## Suggested labels

- `area: infrastructure`, `type: enhancement`, `difficulty: medium`.
