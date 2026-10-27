# AidTrace — Stellar Aid Transparency

AidTrace helps community organizations publish aid disbursement records and lets reviewers compare those records with public Stellar payment evidence.

## Problem and approach

A transaction hash alone does not establish that a particular aid record is accurate. AidTrace checks a successful Stellar transaction and its payment operations on the selected network, then compares the beneficiary destination, amount, asset code and (when supplied) asset issuer. The UI uses four primary outcomes: **Verified on-chain**, **Mismatch**, **Not found**, and **Unverified**. A temporary Horizon outage remains pending and can be retried.

**Important limitation:** a verified transaction proves the payment happened and the compared fields matched; it does not prove that the beneficiary used funds as intended or that an off-chain identity claim is true. Recipient names and addresses may be public, so publish them only with appropriate consent. No wallet seed phrases or private keys are requested or stored. AidTrace does not submit payments.

## Architecture

- React + Vite frontend.
- Stellar Freighter as the only exposed wallet option; login signs a backend-generated challenge and never submits a payment.
- Backend session cookie is HttpOnly, Secure and SameSite=Lax. Challenges expire after five minutes and are single-use. Sessions expire after seven days and support logout-everywhere.
- Server-side database stores sessions, challenges, explicit roles, aid records, rate limits and audit events.
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

The backend enforces this matrix on every protected route. UI visibility is not an authorization control. Role changes, record creation, edits, voids and verification checks are audited. Voids preserve the original record and require a reason; records are not silently deleted.

## Setup

1. Install Node.js 20+ and a recent npm.
2. Install dependencies: `npm install`.
3. Start the frontend: `npm run dev`.
4. Configure the AppDeploy backend SDK/runtime and database using the AppDeploy project deployment environment. The app imports `@appdeploy/client` and `@appdeploy/sdk`, supplied by the AppDeploy runtime.
5. Install Freighter from https://freighter.app/. Select the same network in Freighter and AidTrace.
6. Assign the first admin role through the platform's trusted database/bootstrap process. There is deliberately no unauthenticated admin bootstrap endpoint.
7. Run `npm run build` for the frontend production build. Automated user-flow coverage is defined in `tests/tests.json`.

## Security notes

- Never share or paste a seed phrase or private key into AidTrace.
- Login signs a one-time challenge; no transaction is submitted.
- Session cookie: HttpOnly, Secure, SameSite=Lax; seven-day expiry. Logout-everywhere revokes the sessions visible in the bounded session page.
- CSRF token is bound to the server-side session and required on state-changing routes; requests with a foreign Origin are rejected.
- Challenge, signature-verification and record-verification routes have per-key rate limits. All record fields and Stellar addresses/hashes are validated on the server.
- Organizations may edit/void only their own records; admins manage role assignments. Never rely on frontend-only role checks.
- Verification cache is refreshed after one hour; pending results are not cached as final and can be retried.
- Audit and role listing endpoints are admin-only. Public transparency includes only the record fields the app deliberately publishes.

## Known limitations

- Horizon availability and SSE support depend on the public network endpoint. The UI falls back to periodic reads when SSE disconnects.
- Current list endpoints are bounded to the first 100 records; the frontend paginates the returned set. Large deployments should add database cursor pagination and indexed server-side filtering.
- Logout-everywhere processes up to 100 sessions in one bounded read; large account session counts need cursor pagination.
- Verification handles payment-like Horizon operations in the transaction and compares the recorded payment fields; complex transactions with multiple outputs require careful review.
- The first admin must be bootstrapped through a trusted platform-side process; the app intentionally does not expose a self-service privilege escalation.
- This is not a legal, accounting, identity-attestation, or proof-of-use system. Do not represent blockchain evidence as proof of real-world impact.
