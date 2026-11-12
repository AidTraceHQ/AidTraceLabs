# Detect Changes to Applied Migration Files

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 16 hours

**Release day:** Day 2

## Problem statement

`schema_migrations` records only a version and applied timestamp (`scripts/migrate.ts:65-78`). If an already-released SQL file is edited in place, a deployed database silently skips the changed content while a fresh database applies it.

## Technical implementation requirements

- Compute a stable SHA-256 checksum for each migration file and persist it with the applied version.
- On a later run, compare stored checksums and fail closed on a mismatch before applying further migrations.
- Define an explicit, reviewed baseline procedure for existing rows whose checksum is null; do not imply that a newly calculated checksum proves the historical file was unchanged.
- Keep ordered migration execution and the current duplicate-hash preflight intact.

## Files and areas to touch

- `scripts/migrate.ts`
- `migrations/` (forward-only metadata migration)
- `tests/migrate.test.ts` (new migration runner tests)
- `docs/deployment.md`

## Dependencies

- None. This is integrity detection, separate from #16's concurrent-run lock.

## Measurable acceptance criteria

- A newly applied migration stores its checksum.
- Editing an already-checksummed migration causes a clear no-secret failure before later migrations run.
- Existing null-checksum rows require an explicit documented baseline action.
- Re-running unchanged migrations remains a no-op.

## Expected deliverables

- Checksum storage/comparison, baseline procedure, mocked or isolated DB tests, and maintainer documentation.

## How to set up and run tests

- Run the focused migration runner tests with `npx vitest run tests/migrate.test.ts`.
- Use a disposable PostgreSQL test database only for migration integration coverage.
- Run `npm run typecheck`.

## Out of scope

- Editing historical migration SQL, automatically rewriting databases, or changing the migration framework.

## Suggested labels

- `area: infrastructure`, `area: security`, `type: enhancement`, `difficulty: high`.
