# Drips Application Notes

Verified 2026-11-09 against the repository, GitHub settings, and the live demo at
https://aidtrace-demo.vercel.app.

## What AidTrace Does

AidTrace publishes aid disbursement records and compares their payment fields with public Stellar
transaction data. It does not submit payments. The hosted demo uses the `demo` Neon branch and
defaults to Stellar testnet.

## Stack

- TypeScript, React 19, and Vite 6 for the frontend.
- Express 5 and PostgreSQL for the API, sessions, roles, records, migrations, and audit events.
- Stellar SDK, Freighter wallet API, and read-only Stellar Horizon requests.
- Vitest and Supertest for tests; Vercel static hosting and a serverless API function for the demo.

## Verification

`checkTransaction` reads the transaction and its operations from Horizon on the selected network.
It requires transaction success and one supported payment operation whose source, destination,
amount, asset code, and issuer match the record. Amounts are compared in stroops. A verified result
therefore confirms transaction fields, not that funds were used for aid, that a person was
identified, or that a real-world outcome occurred. It does not establish beneficiary consent or
impact. See `server/stellar-verification.ts`.

## Security Evidence

- Login is SIWS-style: Freighter signs a short-lived server challenge, and the server verifies the
  SEP-53 Stellar Signed Message signature. No private key or seed phrase is requested.
- Sessions use HttpOnly, Secure, SameSite=Lax cookies. CSRF tokens are HMAC-derived from the session
  token, stored as hashes, and checked on state-changing requests; origin checks also apply.
- Authentication, public reads, API requests, writes, and record verification have rate limits.
  The hosted Vercel demo uses in-memory per-instance rate-limit state, not a shared counter.
- Public record projection withholds beneficiary identifiers and transaction details when explicit
  recipient consent is absent.
- The CodeQL workflow runs on pull requests, pushes to main, and a weekly schedule. GitHub reported
  zero open code-scanning alerts on 2026-11-09.
- GitHub main branch protection requires pull-request reviews and status checks. Admin enforcement
  is disabled, so those rules are not enforced for repository administrators.

## Test Evidence

The full `npm test` run discovered 36 tests: 35 passed and one timed out. The timeout was the
serverless handler import in `tests/serverless.test.ts` at the configured 30-second limit. Running
that file alone with a temporary 60-second timeout passed all 3 tests. The full-suite timeout is
not presented as a passing test result.

## Contributor Issues

GitHub showed 18 open issues on 2026-11-09:

- #11 Testnet Context Banner; #12 CSV Export Tests; #13 Public Verification Page; #14 Record Receipt
  Export; #15 Admin Audit Viewer Filters; #16 Dashboard Totals.
- #17 Multi-Operation Transaction Coverage; #18 Scheduled Re-Verification; #19 Beneficiary Wallet
  Acknowledgment; #20 Webhook or Email Alerts; #21 Playwright End-to-End Tests; #22 Cursor Pagination
  UI.
- #23 Accessibility Pass; #24 Internationalization Groundwork; #25 TypeScript 7 major upgrade;
  #26 Vite 8 major upgrade; #27 Tailwind CSS 4 major upgrade; #28 Design: re-entering a payment
  after a record is voided.

The repository's GitHub labels include area, difficulty, and type groups plus `good first issue` and
`help wanted`. The local Vitest major-upgrade note is a draft and is not one of those open GitHub
issues.

## Hosted Demo Limits

- The API runs as a Vercel serverless function; per-instance in-memory rate limits are not shared.
- Stellar testnet is the default network; Horizon availability can delay or leave verification
  pending.
- The Vercel GitHub app is uninstalled, so pushes do not redeploy the demo. Manual authenticated
  Vercel CLI redeploys are required.
- No Freighter browser journey was run as part of this readiness check. The frontend and health
  endpoint returned HTTP 200 / `ok: true`.
- The requested screenshots (`public-ledger.png`, `verified-record.png`, `mismatch-record.png`,
  and `admin-page.png`) are not present in `docs/images/`.
