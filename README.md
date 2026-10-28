# AidTrace — Stellar Aid Transparency

AidTrace helps community organizations publish aid disbursement records and lets reviewers compare those records with public Stellar payment evidence.

## Problem and approach

A transaction hash alone does not establish that a particular aid record is accurate. AidTrace checks a successful Stellar transaction and its payment operations on the selected network, then compares the beneficiary destination, amount, asset code and (when supplied) asset issuer. The UI uses four primary outcomes: **Verified on-chain**, **Mismatch**, **Not found**, and **Unverified**. A temporary Horizon outage remains pending and can be retried.

**Important limitation:** a verified transaction proves the payment happened and the compared fields matched; it does not prove that the beneficiary used funds as intended or that an off-chain identity claim is true. Beneficiary details are pseudonymous on the public ledger by default; enabling recipient consent publishes the full beneficiary projection. No wallet seed phrases or private keys are requested or stored. AidTrace does not submit payments.

## Architecture

- React + Vite frontend.
- Stellar Freighter as the only exposed wallet option; login signs a backend-generated challenge and never submits a payment.
- Backend session cookie is HttpOnly, Secure and SameSite=Lax. Challenges expire after five minutes and are single-use. Sessions expire after seven days and support logout-everywhere.
- A self-hosted Express API uses PostgreSQL (`DATABASE_URL`) for sessions, challenges, roles, organizations, aid records, verification history, rate limits and audit events.
- Stellar Horizon is read-only for account activity and transaction/operation verification. My Activity uses the Horizon payment SSE stream with polling fallback.
- Public transparency reads published records without login. Mutations require a wallet session, a matching CSRF token and an allowed role.

## Permission table

| Role | Public ledger | My activity | Beneficiary records | Create records | Edit/void records | Roles and audit |
|---|---|---|---|---|---|---|
| Anonymous | Read | No | No | No | No | No |
| Donor (default) | Read | Own connected wallet | No | No | No | No |
| Beneficiary | Read | Own connected wallet | Only records whose recipient wallet is their address | No | No | No |
| Organization | Read | Own connected wallet | No | Create | Own records only | No |
| Admin | Read | Own connected wallet | Available through beneficiary route if authorized by current policy | Create | Any record | Manage roles and read audit log |

The backend enforces this matrix on every protected route. UI visibility is not an authorization control. Role changes, record creation, edits, voids and verification checks are audited. Voids preserve the original record and require a reason; records are not silently deleted. Any authenticated role may request verification of a public record.

## Setup

1. Install Node.js 20+ and a recent npm.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env`; configure PostgreSQL in `DATABASE_URL`, set `SESSION_SECRET` to at least 32 random bytes, and set the allowed frontend origins. Do not commit `.env`.
4. Apply schema migrations with `npm run db:migrate`. Set `ADMIN_WALLET` to a Stellar public G-address and run `npm run db:seed-admin` to bootstrap the first admin; there is no public admin-bootstrap endpoint.
5. Start the API with `npm run dev:server` and the frontend with `npm run dev`. The default frontend API URL is `http://localhost:3001`; choose same-site HTTPS origins for deployment because the session cookie is Secure and SameSite=Lax.
6. Install Freighter from https://freighter.app/. Select the same network in Freighter and AidTrace.
7. Run `npm run build` for the frontend and server production builds; `npm test` runs Vitest/Supertest. `tests/tests.json` remains the user-flow scenario catalog, while executable backend tests are in `tests/backend.test.ts`.

## Security notes

- Never share or paste a seed phrase or private key into AidTrace.
- Login signs a one-time challenge; no transaction is submitted.
- Session cookie: HttpOnly, Secure, SameSite=Lax; seven-day expiry. Logout-everywhere revokes every active session for the wallet.
- CSRF token is bound to the server-side session and required on state-changing routes; requests with a foreign Origin are rejected.
- Challenge, signature-verification, writes, and record-verification routes have atomic per-key rate limits. General per-IP/read limits are not implemented. Record fields, Stellar addresses/hashes, and list filters are validated on the server.
- API responses use `Cache-Control: no-store`; list endpoints use signed, filter-bound cursor pagination and server-side filtering.
- Organizations may edit/void only their own records; admins manage role assignments. Never rely on frontend-only role checks.
- Verification results are recorded as history; verified/mismatch results may be cached for one hour, while pending results can be retried.
- Verification requires the payment source to match the organization's stored wallet, in addition to a successful transaction and matching destination, amount, asset and issuer fields. It still does not prove that the beneficiary used funds as intended.
- Audit and role listing endpoints are admin-only. Public transparency includes only the record fields the app deliberately publishes.

## Known limitations

- Horizon availability and SSE support depend on the public network endpoint. The UI falls back to periodic reads when SSE disconnects.
- Aid records enforce a unique `(network, tx_hash)` constraint. The migration preflight reports duplicate hashes and aborts; operators must resolve duplicates before applying the index.
- Public list endpoints are cursor-paginated and filtered server-side. The frontend follows all returned pages.
- Verification compares all expected fields against one matching operation, including the source wallet. Multi-operation transactions may be verified when one operation fully matches; if operation pagination exceeds its safe bound, the result remains pending.
- PostgreSQL migrations and DB-backed tests require a configured PostgreSQL service. In environments without `TEST_DATABASE_URL`, four DB integration tests are skipped; see [docs/parity-report.md](./docs/parity-report.md) for the recorded verification limits.
- AppDeploy reference files remain in the working branch until the documented parity gate is satisfied; see [docs/parity-report.md](./docs/parity-report.md).
- This is not a legal, accounting, identity-attestation, or proof-of-use system. Do not represent blockchain evidence as proof of real-world impact.
