# Contributing to AidTrace

Thanks for considering a contribution. Keep changes focused, tested, and honest about what the application proves.

## Local setup

1. Use Node.js 20 or newer and npm.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and configure a local PostgreSQL database. Docker Compose is provided, but has not been verified on every platform. Neon is optional; use a development branch for `DATABASE_URL` and a separate test branch for `TEST_DATABASE_URL`.
4. Set distinct random values of at least 32 bytes for `SESSION_SECRET` and `PSEUDONYM_SECRET`. The pseudonym key must not be the session key.
5. Apply migrations with `npm run db:migrate`. Set `ADMIN_WALLET` to a Stellar public address before running `npm run db:seed-admin`.
6. Start the API and frontend with `npm run dev`.

Do not commit `.env` files, database URLs, private keys, signed messages, cookies, or tokens. Never use a production database for tests. The test bootstrap rejects a test endpoint that matches the configured production host or runtime endpoint.

## Claiming work

For planned work, open or comment on an issue and wait for an acknowledgment before investing in a large change. State the intended scope and approach. Small corrections can be submitted directly as a pull request. Do not claim an issue by making changes to someone else's branch.

## Branches and pull requests

- Create a short branch from `main`, such as `fix/pseudonym-secret` or `docs/deployment-guide`.
- Keep each pull request focused; explain behavior changes, security or privacy impact, and any known limitations.
- Link the issue when one exists. Include screenshots only for user-facing changes and do not include real beneficiary data.
- Complete the pull request checklist and respond to review feedback.

## Commit style

Use concise Conventional Commit subjects, for example `fix: separate pseudonym secret` or `docs: clarify verification limits`. Keep commits small enough to review. Do not add trailers other than a truthful `Co-authored-by: Name <email>` trailer when a real co-author has agreed.

## Tests and checks

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run check` runs all four gates.

Database-backed tests need `TEST_DATABASE_URL` pointed at a dedicated disposable/test branch. Tests use Stellar Horizon mocks unless a test explicitly documents otherwise. Do not use real funds or production records.

## Scope and evidence

AidTrace checks transaction data on the selected Stellar network. A matching result does not establish a beneficiary's identity, consent, intended use, or real-world impact. Contributions must not imply otherwise. Do not add a Soroban contract or claim deployed services unless separately implemented and verified.
