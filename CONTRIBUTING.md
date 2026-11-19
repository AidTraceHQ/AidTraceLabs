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
- `npm test`
- `npm run build`
- `npm run check` runs all four gates.

Database-backed tests need `TEST_DATABASE_URL` pointed at a dedicated disposable/test branch. Tests use Stellar Horizon mocks unless a test explicitly documents otherwise. Do not use real funds or production records.

### Browser tests

The Playwright suite runs the rendered app and API against `TEST_DATABASE_URL`. Set
`TEST_DATABASE_BRANCH=test`, `TEST_DATABASE_URL_UNPOOLED`, and `PRODUCTION_DATABASE_HOST` as
described in the local setup. The test URL must point to a dedicated disposable database and be
different from both `DATABASE_URL` and the production host; the suite applies migrations and
removes its own generated fixtures.

Install Chromium once with `npx playwright install chromium`, then run `npm run test:e2e`. The
suite exercises the real signed login challenge with generated in-memory Stellar keypairs, mocks
the public Freighter provider message API and testnet Horizon responses, and blocks unexpected
external network requests. It never uses a seed phrase, submits a transaction, or contacts a
production network. Playwright retains traces and screenshots only for failed tests.

## Scope and evidence

AidTrace checks transaction data on the selected Stellar network. A matching result does not establish a beneficiary's identity, consent, intended use, or real-world impact. Contributions must not imply otherwise. Do not add a Soroban contract or claim deployed services unless separately implemented and verified.

## AI assistance

Parts of this project were written with AI coding assistants. Every change is reviewed, tested, and approved by a human maintainer before it is merged. Contributors must be able to explain any code they submit, whatever tools helped produce it. Untested or unexplained AI-generated contributions will be declined.
