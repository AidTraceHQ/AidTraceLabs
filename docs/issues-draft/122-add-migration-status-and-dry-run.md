# Add a Migration Status and Dry-Run Report

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 1

## Problem statement

The only migration entry point applies every pending file immediately:

- `package.json:14` exposes exactly one command, `db:migrate`, mapped to `scripts/migrate.ts`.
- `scripts/migrate.ts:65-110` (`migrate()`) creates `schema_migrations` if absent
  (`scripts/migrate.ts:67-72`), lists the migration files (`scripts/migrate.ts:74-76`), and for each
  unapplied file runs it inside a transaction and records the version
  (`scripts/migrate.ts:78-105`). There is no flag, no listing mode, and no way to see what a run
  _would_ do.

An operator preparing a deployment must therefore either read the directory by hand and query
`schema_migrations` with a separate client, or run the migration for real and accept the side effects.
Migration 002 additionally aborts on duplicate hashes (`scripts/migrate.ts:43-63, 96-104`), so a
surprise during a deploy is a plausible outcome.

Affected: maintainers and any reviewer who needs to confirm that a shared environment is up to date
with `migrations/` before testing or before merging a schema change.

## Technical implementation requirements

- Add a read-only mode to `scripts/migrate.ts`, for example `tsx scripts/migrate.ts --status`, that
  prints for every file in `migrations/` (sorted by name, same filter as
  `scripts/migrate.ts:74-76`): the filename, whether it is applied, and, when applied, the
  `applied_at` timestamp from `schema_migrations`.
- Add a `--dry-run` mode that prints the files that _would_ be applied and exits with status `0`
  without executing any DDL; it must not create the `schema_migrations` table if it does not exist
  (report "schema not initialised" instead).
- Set a distinct, non-zero exit code when a run would apply migrations, so CI can use `--status` as a
  drift check if desired; document the codes in the command help.
- Keep `npm run db:migrate` behaviour unchanged: with no flag, apply pending migrations exactly as today
  (`scripts/migrate.ts:65-110`), including the 002 duplicate-hash abort.
- Expose the modes through `package.json` scripts (`package.json:6-24`), for example
  `db:migrate:status`.
- Do not add checksum recording (draft "Detect Changes to Applied Migration Files"), a locking mechanism (draft "Serialize Concurrent Migration Runs"), filename validation
  (draft "Reject unrecognized and non-sequential migration files"), or pool timeouts (draft "Add Timeouts to the Migration Pool"); those are separate issues.
- Never print the connection string or any row data; only filenames, states, and timestamps.

## Files and areas to touch

- `scripts/migrate.ts`
- `package.json`
- `docs/deployment.md` (a short "checking migration state" subsection)
- `CONTRIBUTING.md` (local setup line near `CONTRIBUTING.md:11`)

## Dependencies

- None. Distinct from drafts "Serialize Concurrent Migration Runs", "Detect Changes to Applied Migration Files", "Add Timeouts to the Migration Pool", "Reject unrecognized and non-sequential migration files"; those change execution safety, this adds a
  read-only report. Agree on flag names so a later checksum/lock issue can extend the same command.

## Measurable acceptance criteria

- `npx tsx scripts/migrate.ts --status` lists every file in `migrations/` with applied/pending state and
  does not modify the database (verified by comparing `schema_migrations` rows before and after).
- `npx tsx scripts/migrate.ts --dry-run` reports pending files and applies nothing; on a database with no
  `schema_migrations` table it reports the uninitialised state instead of failing with a raw SQL error or
  creating the table.
- `npm run db:migrate` (no flag) behaves as before.
- The command output contains no connection string.
- `npm run typecheck` and `npm run lint` pass.

## Expected deliverables

- The status/dry-run modes, the npm scripts, and the documentation lines above.

## How to set up and run tests

- Use a disposable `TEST_DATABASE_URL` (`CONTRIBUTING.md:39`).
- `npm run db:migrate` then `npx tsx scripts/migrate.ts --status` and confirm every file shows `applied`.
- `npx tsx scripts/migrate.ts --dry-run` and confirm it reports nothing pending; then run it against an
  empty database and confirm it reports the uninitialised state without creating the table.
- `npm run typecheck`, `npm run lint`.

## Out of scope

- Rollback/down migrations, checksum verification, advisory locking, changing the migration SQL, or
  altering which files the runner accepts.

## Suggested labels

- `area: infrastructure`, `type: enhancement`, `difficulty: medium`.
