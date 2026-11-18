# Detect Changes to Applied Migration Files

**Complexity:** intermediate

## Context

The `migrate()` function in `scripts/migrate.ts` (lines 65Ã¢â‚¬â€œ78) records only a version and applied timestamp in `schema_migrations`. If an already-released SQL file is edited in place, a deployed database silently skips the changed content while a fresh database applies the new version. Affected users: operators running migrations who cannot detect schema drift between environments. Current behavior: no checksum is stored; editing a migration file after deployment is undetectable. Expected behavior: a stable SHA-256 checksum is computed for each migration file and persisted with the applied version. On a later run, stored checksums are compared and the runner fails closed on a mismatch before applying further migrations. Existing null checksums require an explicit reviewed baseline procedure.

## Acceptance criteria

- Test `stores the SHA-256 checksum for a newly applied migration` asserts the `schema_migrations` row has a non-null checksum equal to the file's SHA-256.
- Test `fails closed when an already-checksummed migration file changes` asserts a modified file throws before any later migration runs, and logs no file contents or secrets.
- Test `is a no-op when migrations are unchanged` asserts a second run applies zero migrations.
- `npx vitest run tests/migrate.test.ts` passes.

## Files to touch

- `scripts/migrate.ts`
- `migrations/` (forward-only metadata migration)
- `tests/migrate.test.ts` (new migration runner tests)
- `docs/deployment.md`

## Test expectations

- Run: `npx vitest run tests/migrate.test.ts`
- Use a disposable PostgreSQL test database only for migration integration coverage.
- Run: `npm run typecheck`

## Out of scope

Editing historical migration SQL, automatically rewriting databases, or changing the migration framework.

## Depends on

None
