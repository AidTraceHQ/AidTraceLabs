# Add a Migration Status and Dry-Run Report

**Complexity:** intermediate

## Context

The only migration entry point applies every pending file immediately. `package.json` (line 14) exposes exactly one command, `db:migrate`, mapped to `scripts/migrate.ts`. The `migrate()` function (lines 65Ã¢â‚¬â€œ110) creates `schema_migrations` if absent, lists the migration files, and for each unapplied file runs it inside a transaction. There is no flag, no listing mode, and no way to see what a run would do. An operator preparing a deployment must either read the directory by hand and query `schema_migrations` with a separate client, or run the migration for real. Affected: maintainers and reviewers who need to confirm that a shared environment is up to date with `migrations/` before testing or merging a schema change.

## Acceptance criteria

- `npx tsx scripts/migrate.ts --status` lists every file in `migrations/` with applied/pending state and does not modify the database (verified by comparing `schema_migrations` rows before and after).
- `npx tsx scripts/migrate.ts --dry-run` reports pending files and applies nothing; on a database with no `schema_migrations` table it reports the uninitialized state instead of failing with a raw SQL error or creating the table.
- `npm run db:migrate` (no flag) behaves as before.
- The command output contains no connection string.
- `npm run typecheck` and `npm run lint` pass.

## Files to touch

- `scripts/migrate.ts`
- `package.json`
- `docs/deployment.md` (a short "checking migration state" subsection)
- `CONTRIBUTING.md` (local setup line)

## Test expectations

- Configure: disposable `TEST_DATABASE_URL` (see `CONTRIBUTING.md`)
- Run: `npm run db:migrate` then `npx tsx scripts/migrate.ts --status` and confirm every file shows `applied`.
- Run: `npx tsx scripts/migrate.ts --dry-run` and confirm it reports nothing pending; then run against an empty database and confirm it reports the uninitialized state without creating the table.
- Run: `npm run typecheck`, `npm run lint`

## Out of scope

Rollback/down migrations, checksum verification, advisory locking, changing the migration SQL, or altering which files the runner accepts.

## Depends on

None
