# Contributing to AidTrace

Thanks for considering a contribution. Keep changes focused, tested, and honest about what the application proves.

## Local setup

1. Use Node.js 20 or newer and npm.
2. Install dependencies with `npm ci`. The first install can take several minutes on a fresh machine.
3. Run `npm run setup:env` to create `.env.local` from `.env.example` when the file does not already exist. Keep the generated file local and do not commit it. Docker Compose is provided, but has not been verified on every platform. Neon is optional; use a development branch for `DATABASE_URL` and a separate test branch for `TEST_DATABASE_URL`.
4. Set distinct random values of at least 32 bytes for `SESSION_SECRET` and `PSEUDONYM_SECRET`. The pseudonym key must not be the session key.
5. Apply migrations with `npm run db:migrate`. Set `ADMIN_WALLET` to a Stellar public address before running `npm run db:seed-admin`.
6. Start the API and frontend with `npm run dev` and run `npm run smoke` against the local stack to verify the health and transparency routes return `200`.

Do not commit `.env` files, database URLs, private keys, signed messages, cookies, or tokens. Never use a production database for tests. The test bootstrap rejects a test endpoint that matches the configured production host or runtime endpoint.

## Claiming work

For planned work, open or comment on an issue and wait for an acknowledgment before investing in a large change. State the intended scope and approach. Small corrections can be submitted directly as a pull request. Do not claim an issue by making changes to someone else's branch.

## Branches and pull requests

- Create a short branch from `main`, such as `fix/pseudonym-secret` or `docs/deployment-guide`.
- Keep each pull request focused; explain behavior changes, security or privacy impact, and any known limitations.
- Link the issue when one exists. Include screenshots only for user-facing changes and do not include real beneficiary data.
- Complete the pull request checklist and respond to review feedback.

## Stellar Wave contributions

- Ask to be assigned in a comment before starting; wait for the maintainer to assign you.
- The PR description must include "Closes #<issue number>".
- Run `npm run check` (typecheck, lint, format check, tests, build) and paste the result summary in the PR.

- Keep the PR within the issue's scope (see "Out of scope"); one issue per PR.
- Tests are expected for behavior changes; PRs must be explainable by their author.

## Commit style

Use concise Conventional Commit subjects, for example `fix: separate pseudonym secret` or `docs: clarify verification limits`. Keep commits small enough to review. Do not add trailers other than a truthful `Co-authored-by: Name <email>` trailer when a real co-author has agreed.

## Tests and checks

- `npm run typecheck`
- `npm run lint`
- `npm test` (suite only, without coverage)
- `npm run test:coverage` (backend coverage report and threshold gate)
- `npm run build`
- `npm run check` runs typecheck, lint, format check, tests, smoke, and build.
  CI runs `npm run test:coverage` in place of `npm test`; run both `npm run check`
  and `npm run test:coverage` before submitting a PR.

Database-backed tests need `TEST_DATABASE_URL` pointed at a dedicated disposable/test branch. Tests use Stellar Horizon mocks unless a test explicitly documents otherwise. Do not use real funds or production records.

### Coverage gate

`npm run test:coverage` uses Vitest's V8 provider and the same test suite as
`npm test`. It measures all `server/**/*.ts` files, including unimported files;
this is backend coverage, not a frontend/UI coverage claim. The terminal summary,
`coverage/coverage-summary.json`, and `coverage/index.html` show the results. These
reports are local build output: do not commit them.

The initial baseline on `789b410` (Node 20, PostgreSQL 16, all 36 tests passing,
none skipped) and committed percentage floors are below. Each cell is
**measured / minimum**; exact-path floors apply independently to each critical
module as well as the aggregate backend floor.

| Scope                            | Statements | Branches   | Functions    | Lines      |
| -------------------------------- | ---------- | ---------- | ------------ | ---------- |
| All server files                 | 75.48 / 75 | 68.08 / 68 | 89.23 / 89   | 78.44 / 78 |
| `server/auth.ts`                 | 78.91 / 78 | 72.07 / 72 | 96.29 / 96   | 80.47 / 80 |
| `server/records.ts`              | 71.45 / 71 | 67.80 / 67 | 91.93 / 91   | 75.00 / 75 |
| `server/stellar-verification.ts` | 84.61 / 84 | 64.22 / 64 | 100.00 / 100 | 88.79 / 88 |

Use the dedicated test database settings described above when measuring coverage.
Without the database-backed tests, the measured baseline is incomplete and the
gate fails. CI supplies a disposable PostgreSQL service. When coverage improves,
review and raise the floors in `vitest.config.ts`; do not lower them simply to
make a change pass, or exclude uncovered code to hide a regression.

To check the failure path, temporarily raise a floor above its measured value
(for example, set the global statements floor to 100), run
`npm run test:coverage`, and verify a non-zero exit with a threshold error.
A new untested branch that drops `server/auth.ts` below its own branch floor must
also fail, even if aggregate coverage still passes. Restore any temporary edits
and rerun the normal gate before committing.

## Scope and evidence

AidTrace checks transaction data on the selected Stellar network. A matching result does not establish a beneficiary's identity, consent, intended use, or real-world impact. Contributions must not imply otherwise. Do not add a Soroban contract or claim deployed services unless separately implemented and verified.

## AI assistance

Parts of this project were written with AI coding assistants. Every change is reviewed, tested, and approved by a human maintainer before it is merged. Contributors must be able to explain any code they submit, whatever tools helped produce it. Untested or unexplained AI-generated contributions will be declined.
