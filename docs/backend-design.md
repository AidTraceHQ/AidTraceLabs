# AidTrace self-hosted backend: as-built design

**Status:** implemented backend and frontend adapter on `remove-appdeploy`; no push has been made. This document distinguishes checked-in code from behavior verified against a live PostgreSQL database or browser.

## Evidence and scope

The self-hosted implementation is in `server/`, `migrations/`, `scripts/`, and `src/api.ts`. The legacy backend reference is read-only `origin/main` at `3fd7cc9f3ef98405640ee9fecacf9bbf41633afe`, inspected with `git show origin/main:backend/index.ts`. The UI in `src/App.tsx` had a reconstructed tail; visual and end-to-end UI parity is not established. PostgreSQL was unavailable in this environment, so database migrations and four DB-backed integration cases were not run.

Approved decisions reflected here: PostgreSQL via `DATABASE_URL` in local and production environments; Stellar SDK verification using the existing SEP-53 message format; pseudonymous beneficiary presentation by default; payment-source verification against the organization wallet; and unique `(network, tx_hash)` enforcement with duplicate preflight.

## 1. Implemented vs proposed

“Implemented” means relevant application code is present. It does not imply a deployed service or a successful live-PostgreSQL run.

| Feature | Status | Evidence |
|---|---|---|
| Express API, JSON limits, error handling, health route | IMPLEMENTED | `server/app.ts` exports the Express app, limits JSON requests to 32 KB, and handles malformed/oversized bodies. `GET /api/_healthcheck` returns process liveness, not database readiness. |
| PostgreSQL persistence and migrations | IMPLEMENTED; live DB UNCONFIRMED | `server/db.ts`, `migrations/001_initial_schema.sql`, `migrations/002_unique_network_tx_hash.sql`, `scripts/migrate.ts`. No PostgreSQL service was available for migration/integration tests. |
| Wallet challenge and Freighter client flow | IMPLEMENTED; browser journey UNCONFIRMED | `server/auth.ts` issues five-minute, one-use challenges; `src/App.tsx` signs through Freighter. |
| SEP-53 signature verification | IMPLEMENTED; real Freighter interoperability UNCONFIRMED | `verifySep53Signature` uses `Keypair.fromPublicKey` from `@stellar/stellar-sdk`, SHA-256 of the SEP-53 prefix plus exact UTF-8 message, and Ed25519 verification. Generated-keypair tests passed. |
| Sessions, cookie, CSRF, logout | IMPLEMENTED; browser cookie behavior UNCONFIRMED | `server/auth.ts`; hashed session and CSRF tokens, seven-day expiry, revocation timestamps, session-bound CSRF, and logout-everywhere. Cookie is always `HttpOnly; Secure; SameSite=Lax`. |
| Roles and record authorization | IMPLEMENTED; database integration UNCONFIRMED | `server/records.ts` authorizes writes server-side, enforces organization ownership, scopes beneficiary reads, and restricts roles/audit to admins. |
| Record validation and immutable void fields | IMPLEMENTED; live DB constraints UNCONFIRMED | `validateRecord`, record routes and `aid_records` constraints; voids set reason/actor/time and do not delete. |
| Transaction uniqueness and duplicate preflight | IMPLEMENTED in migration and write handling; migration run UNCONFIRMED | Migration runner reports case-insensitive duplicates and aborts before applying migration 002; unique violation maps to HTTP 409. |
| Horizon verification and result history | IMPLEMENTED; live Horizon end-to-end UNCONFIRMED | `server/stellar-verification.ts` checks source, destination, amount, asset and issuer on one operation, supports operation pagination, and records result history. Mocked Horizon cases passed. |
| Cursor pagination and server-side filters | IMPLEMENTED; DB integration UNCONFIRMED | Record, beneficiary, role and audit lists use keyset pages and SQL filters. Cursors are HMAC-signed and filter-bound in `server/records.ts`. |
| Public beneficiary minimization | IMPLEMENTED in API projection; consent/product review UNCONFIRMED | `publicRecord` replaces name with a stable pseudonym and blanks wallet, transaction hash and note unless consent is true; selected verification details are removed. Organization and creator identifiers remain in the public record. |
| Rate limiting | PARTIAL | Atomic hashed-key database limits exist for challenge (8/15 minutes per address), signature verify (12/minute per address), writes (60/minute per wallet), and record verify (30/minute per wallet). No general per-IP/read limiter exists. |
| Audit coverage | PARTIAL | Authentication, logout, record create/edit/void/verification, and role add/remove are logged. Challenge issuance, failed attempts, admin seed, and all security rejections are not comprehensively logged. Append-only privileges are not configured by migrations. |
| Admin bootstrap, environment template and start scripts | IMPLEMENTED; operations not exercised | `scripts/seed-admin.ts` reads `ADMIN_WALLET`; `.env.example` contains placeholders; npm scripts provide migration, dev, build and server start commands. |
| `tests/tests.json` scenarios | PARTIAL | Executable Vitest/Supertest tests are in `tests/backend.test.ts`; they do not execute every UI/browser scenario from the JSON catalog. |
| Reference UI parity (Freighter browser journey, SSE, responsive/CSV behavior) | UNCONFIRMED | No browser automation or visual comparison was run; UI tail reconstruction means source-level presence is not proof of parity. |
| AppDeploy removal | PROPOSED / gated | Legacy reference code and declarations remain. Removal is not permitted until the parity gate is satisfied. |

### Legacy AppDeploy surface observed in `origin/main`

`backend/index.ts` imports `router`, `json`, `error`, and `db` from `@appdeploy/sdk`. `router({...})` declares the routes; `json`/`error` form responses; `db.get` reads records, roles, sessions, challenges and rate-limit rows; `db.tx.add` inserts rows; `db.tx.update` conditionally patches them; `db.update` writes verification results; and `db.delete` removes sessions/roles. `@appdeploy/client` in the old frontend supplied the client API calls. The hosted SDK's database engine, atomicity, cookie forwarding, CORS/preflight, generated IDs/timestamps, and error mapping are not established by repository code. The local Express/PostgreSQL implementation makes those behaviors explicit instead.

## 2. Data model

PostgreSQL is the only supported database. All tables and indexes below are created by `migrations/001_initial_schema.sql` and `migrations/002_unique_network_tx_hash.sql`.

| Table | Columns and types | Constraints and indexes | Behavior preserved |
|---|---|---|---|
| `users` | `wallet_address TEXT`, `created_at TIMESTAMPTZ`, `last_authenticated_at TIMESTAMPTZ` | Wallet primary key | One wallet identity; records first/most-recent authentication. |
| `wallet_roles` | `wallet_address TEXT`, `role TEXT`, `updated_by TEXT`, `updated_at TIMESTAMPTZ` | Wallet primary key/FK; role in `donor`, `organization`, `beneficiary`, `admin`; index `(role,wallet_address)` | Explicit one-role-per-wallet assignments; wallets without a row are donors. |
| `organizations` | `wallet_address TEXT`, `display_name TEXT`, `normalized_name TEXT`, timestamps | Wallet primary key/FK; normalized name unique | Organization is associated with its wallet; verification compares this wallet to the Stellar payment source. |
| `sessions` | `session_hash TEXT`, `wallet_address TEXT`, `network TEXT`, `csrf_token_hash TEXT`, `created_at`, `expires_at`, `revoked_at`, `last_seen_at` | Session hash primary key; wallet FK; network check; indexes `(wallet_address,revoked_at,expires_at)` and partial active expiry | Session tokens are stored hashed; expiry and revocation enable logout and logout-everywhere; CSRF is bound to the session. |
| `challenges` | `challenge_id TEXT`, `nonce TEXT`, `wallet_address TEXT`, `network TEXT`, `signed_message TEXT`, `created_at`, `expires_at`, `used_at` | Challenge ID primary key; unique nonce; wallet FK; network check; index `(wallet_address,expires_at,used_at)` | Stores the exact signed message, five-minute expiry and one-time-use state. |
| `aid_records` | `id TEXT`, `organization_wallet TEXT`, `recipient_name TEXT`, `recipient_wallet TEXT`, `purpose TEXT`, `amount_stroops BIGINT`, `asset_code TEXT`, `asset_issuer TEXT`, `network TEXT`, `tx_hash TEXT`, `disbursement_date DATE`, `note TEXT`, `recipient_consent BOOLEAN`, `status TEXT`, `created_by TEXT`, timestamps, `void_reason TEXT`, `voided_by TEXT`, `voided_at TIMESTAMPTZ` | ID primary key; org/creator/voider FKs; positive amount; network/status checks; void fields are all NULL or all populated; unique `(network,tx_hash)`; indexes by created time, org/time, recipient/time, and network/status/date | Stores validated aid records, their organization, publication consent, current verification status, and non-destructive void history. |
| `verification_results` | `id TEXT`, `aid_record_id TEXT`, `status TEXT`, `differences_json JSONB`, `reason TEXT`, `ledger BIGINT`, transaction time, source/destination, amount, asset/issuer, `checked_at`, `cache_expires_at` | ID primary key; record FK; status check; indexes `(aid_record_id,checked_at,id)` and `(status,checked_at)` | Keeps historical verification checks and supports one-hour caching of verified/mismatch results. |
| `rate_limits` | `key_hash TEXT`, `window_start TIMESTAMPTZ`, `request_count INTEGER`, `expires_at TIMESTAMPTZ` | Composite primary key `(key_hash,window_start)`; nonnegative count; expiry index | Atomic per-key counters without storing the raw wallet/IP-derived key. |
| `audit_events` | `id TEXT`, `action TEXT`, `actor_wallet TEXT`, `subject_wallet TEXT`, `record_id TEXT`, `summary TEXT`, `metadata_json JSONB`, `created_at TIMESTAMPTZ` | ID primary key; nullable wallet/record FKs; indexes by time, actor/time, record/time, action/time | Records security-relevant business actions. Database-level append-only permissions are not configured. |

Migration 002's runner preflight counts duplicates partitioned by `(network, LOWER(tx_hash))`, prints all matching IDs/network/hash/count and aborts before applying the migration if any exist. The SQL then normalizes blank hashes to NULL, lowercases remaining hashes, and adds `UNIQUE (network, tx_hash)`. Operators must explicitly resolve duplicates; the migration never deletes or merges records. The duplicate-preflight test seeds case-variant duplicate rows and verifies that the migration aborts before creating the unique index. Migrations 001 and 002 have been applied to the Neon `dev`, `test`, and `production` branches; see [docs/parity-report.md](./parity-report.md) for run evidence.

## 3. API routes

All implemented API handlers set `Cache-Control: no-store`. Pagination responses keep their collection key and add `nextCursor` and `hasMore` in JSON, plus `X-Next-Cursor`, `X-Has-More`, and `Link` when another page exists. Allowed credentialed CORS exposes those headers. Cursor page size is bounded (default 20, maximum 100); list filtering happens in SQL before pagination.

| Method and path | Status vs reference | Auth, CSRF and limits | Request → success response | Main errors |
|---|---|---|---|---|
| `GET /api/_healthcheck` | Existing | Public | — → `200 {ok,service}` | None; does not test DB readiness. |
| `POST /api/auth/challenge` | Existing; Origin enforcement explicit | Public; exact allowed Origin; 8/15m per address | `{address,network}` → `{challengeId,message,expiresAt}` (`expiresAt` milliseconds) | `400`, `403`, `429` |
| `POST /api/auth/verify` | Existing; verifier uses Stellar SDK | Public; exact allowed Origin; 12/min per address | `{challengeId,address,network,signature}` → `{session:{address,network,role,csrfToken,expiresAt}}`; sets cookie | `400`, `401`, `403`, `409` replay, `429` |
| `GET /api/me` | Existing | Optional session | — → `{session:null}` or session object | Invalid/expired session returns null and clears cookie. |
| `POST /api/auth/logout` | Existing; Origin now enforced | Optional session; Origin; CSRF if session exists | `{csrfToken}` → `{ok:true}` and clears cookie | `403` Origin/CSRF |
| `POST /api/auth/logout-everywhere` | Existing; revocation implementation changed | Any authenticated role; Origin + CSRF | `{csrfToken}` → `{ok:true}` and revokes all wallet sessions | `401`, `403` |
| `GET /api/transparency` | Existing; query and privacy behavior changed | Public; optional session affects private projection | Filters: `q,organization,asset,network,status,from,to,limit,cursor`; → `{facets:{organizations,assets},summary:{byStatus:[{status,asset,amount}]},records,nextCursor,hasMore}`. Summary totals are filtered and grouped by record status and asset. | `400` invalid filters |
| `GET /api/beneficiary` | Existing; DB scoping and pagination changed | Beneficiary or admin; session; read | Same record filters plus `limit,cursor`; always scoped to session wallet → `{records,nextCursor,hasMore}` | `400`, `401`, `403` |
| `POST /api/records` | Existing; validation, uniqueness and source verification added | Organization or admin; Origin + CSRF; 60 writes/min per wallet | Existing record fields plus `csrfToken` → `201 {record}` | `400`, `401`, `403`, `409` duplicate hash, `429` |
| `POST /api/records/:id/verify` | Existing; source check and CSRF added | Any authenticated role; Origin + CSRF; 60 writes/min and 30 verifies/min per wallet | `{csrfToken}` → `{record}` | `401`, `403`, `404`, `429`; Horizon failures are a `200` with `pending` result |
| `PUT /api/records/:id` | Existing; validation and concurrency control added | Organization owner or admin; Origin + CSRF; 60 writes/min per wallet | Existing record fields plus `csrfToken` → `{record}` | `400`, `401`, `403`, `404`, `409`, `429` |
| `POST /api/records/:id/void` | Existing; reason and immutable void metadata enforced | Organization owner or admin; Origin + CSRF; 60 writes/min per wallet | `{csrfToken,reason}` → `{record}` | `400`, `401`, `403`, `404`, `409`, `429` |
| `GET /api/admin/roles` | Existing; paginated/filterable; response includes reference `id` | Admin; session; read | `role,q,limit,cursor` → `{roles,nextCursor,hasMore}`; roles include `id,address,role,updatedAt,updatedBy` | `400`, `401`, `403` |
| `POST /api/admin/roles` | Existing | Admin; Origin + CSRF; 60 writes/min | `{csrfToken,address,role}` → `{ok:true}` | `400`, `401`, `403`, `409` self-demotion, `429` |
| `DELETE /api/admin/roles/:address` | Existing | Admin; Origin + CSRF; 60 writes/min | DELETE JSON body `{csrfToken}` → `{ok:true}` | `400`, `401`, `403`, `404`, `409` self-removal, `429` |
| `GET /api/audit` | Existing; paginated/filterable | Admin; session; read | `action,address,recordId,q,limit,cursor` → `{entries,nextCursor,hasMore}` (facets may also be present) | `400`, `401`, `403` |

Errors use `{error:string}`. Unknown routes return `404 {error:"Route not found."}`. A new endpoint for organization profile management is not implemented. Reference list routes previously read at most 100 records; new list routes page through the full matching database set. Other differences and unconfirmed reference-runtime behavior are enumerated in [docs/parity-report.md](./parity-report.md).

## 4. Wallet-signature authentication flow

1. The frontend obtains the wallet public address and network from Freighter; it never asks for a seed phrase or submits a transaction.
2. `POST /api/auth/challenge` checks the Stellar public key and `testnet`/`mainnet`, then stores a 24-byte random challenge ID, 32-byte random nonce, exact message and expiry five minutes from issuance.
3. Freighter signs this exact current SEP-53 message as UTF-8:

   ```text
   AidTrace wallet login
   Domain: <PUBLIC_APP_ORIGIN origin>
   Address: <G...>
   Network: <testnet|mainnet>
   Nonce: <64 lowercase hexadecimal characters>
   Issued At: <UTC ISO-8601 timestamp>
   Expires: <UTC ISO-8601 timestamp>
   Purpose: prove wallet ownership; no transaction will be sent.
   ```

   `Domain` is the origin component of `PUBLIC_APP_ORIGIN`. `Issued At` is the issuance time, exactly five minutes before `Expires`. These fields are part of the SEP-53 signed UTF-8 message and bind the signature to this application and challenge lifetime.
4. `POST /api/auth/verify` checks challenge ID, address, network, unused state and expiry. It verifies `SHA-256(UTF-8("Stellar Signed Message:\n" + exactMessage))` using `Keypair.fromPublicKey(address).verify(...)` from `@stellar/stellar-sdk`.
5. In a PostgreSQL transaction, an atomic conditional update consumes the challenge, updates the user, resolves the role, inserts the session, and writes an authentication audit event. An already-used challenge returns `409`; an expired challenge returns `401`.
6. The server generates random session and CSRF values; it stores only their SHA-256 hashes. The CSRF value is HMAC-derived from the session token and returned to the client. Cookie: `aidtrace_session`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, seven-day max age. Every request re-reads current role and checks expiry/revocation.
7. Logout revokes the current session; logout-everywhere revokes every active session for the wallet. Both clear the cookie; state-changing requests require Origin and CSRF checks.

## 5. Verification design

`server/stellar-verification.ts` keeps the existing successful-transaction, network, destination, amount, asset-code and issuer checks, and additionally requires the operation's source (or transaction source where applicable) to equal the organization's stored wallet. All matching fields must belong to one payment-like operation; values from separate operations are not combined.

Supported operation types include `payment`, `create_account`, `path_payment_strict_receive`, and `path_payment_strict_send`. Strict-send compares the destination amount and destination asset fields. Each transaction's operations are read in 200-operation pages, with a 20-page bound. An incomplete/over-limit read is `pending`, not a false mismatch. A transaction with multiple operations is verified when one complete operation matches; unrelated operations do not invalidate that match.

| Result | Meaning |
|---|---|
| `verified` | Successful transaction has a single operation matching organization source, recipient, amount, asset and issuer. |
| `mismatch` | Transaction exists but is unsuccessful or no operation fully matches the expected fields. |
| `not-found` | Horizon returns 404 for that transaction on the selected network. |
| `unverified` | No transaction hash was supplied. |
| `pending` | Horizon is unavailable/unreadable, or operation pagination could not be completed; retryable and not cached as final. |
| `voided` | Record is administratively voided; void history is retained and the record is not an active verified disbursement. |

Verified and mismatch results may be cached for one hour. Verification history is stored separately in `verification_results`. Verification proves only the checked on-chain payment fields; it does not establish identity, consent, intended use or real-world impact.

## 6. Security requirements and current gaps

- **Authorization:** checked server-side on every protected route. Donors default to read-only public access; beneficiary routes are wallet-scoped; organizations create and edit/void only their own records; admins manage roles and audit. Any signed-in role may request public-record verification. The system currently allows changing another wallet's role even if it is the last other admin; last-admin protection is not implemented.
- **CSRF and Origin:** state-changing authenticated operations require matching session-bound CSRF and an exact configured Origin. Challenge/auth operations and logout also enforce Origin. Credentialed CORS uses an explicit origin, `Vary: Origin`, and exposes pagination headers; no wildcard credentials. A missing Origin is rejected on protected writes/auth POSTs.
- **Cookies and hosting:** cookie is always Secure, HttpOnly, SameSite=Lax. Use HTTPS and same-site frontend/backend origins (or a same-origin reverse proxy). Cross-site deployment would require revisiting SameSite policy.
- **Rate limits:** atomic database counters hash keys. Current limits are listed in §1 and §3. Per-IP request/read limits and broader abuse controls remain to be added before an internet-facing deployment.
- **Validation and database safety:** Stellar addresses, networks, record fields, amount/stroop ranges, dates, assets, transaction hashes, list filters and cursors are checked; SQL values are parameterized. Cursor HMAC uses `SESSION_SECRET`, and cursors are bound to normalized query filters.
- **Audit:** principal successful authentication, logout, record, verification and role actions are recorded. Failed attempts, challenge issuance, seed operations and all rejection events need fuller audit coverage. Configure least-privilege DB roles; migrations do not enforce append-only audit access.
- **Secrets/admin:** keep `DATABASE_URL`, `SESSION_SECRET` and other secrets in environment/secret storage, never Vite-exposed variables or committed `.env`. The seed script validates `ADMIN_WALLET`; there is no public bootstrap endpoint. Do not log signatures, session cookies, CSRF values or private keys.
- **Beneficiary privacy:** public transparency uses a pseudonymous beneficiary label by default and blanks recipient wallet, transaction hash, note and selected verification details without consent. Setting consent exposes the full beneficiary projection. This is a minimization measure, not a guarantee of anonymity; amount, date, organization, creator and purpose remain public.
- **Logging/dependencies:** error middleware logs unhandled server errors; avoid putting request bodies or beneficiary PII in logs. `npm audit` was run and reported zero vulnerabilities at the time of this document.

## 7. Deployment requirements

- Node.js 20+; PostgreSQL for both local and production deployments via `DATABASE_URL`.
- Copy `.env.example` to a local environment file and set a PostgreSQL connection string, a `SESSION_SECRET` of at least 32 bytes, allowed frontend origins, Horizon endpoints and (for bootstrap) `ADMIN_WALLET`. `.env.example` contains placeholders only.
- Install dependencies with `npm install`; run `npm run db:migrate`; optionally bootstrap with `npm run db:seed-admin`; run `npm run dev:server` alongside `npm run dev`. Production: `npm run build`, then `npm run start:server`, and host the built Vite assets behind HTTPS.
- Hosting options: deploy Vite assets to any static HTTPS host and run the Express API on a Node 20+ host/container/VM connected to PostgreSQL, or serve both behind one HTTPS reverse proxy. The same-origin reverse-proxy option is preferred. Separate origins must be explicitly configured in CORS and remain same-site for the Lax session cookie.
- Configure `PUBLIC_APP_ORIGIN` and `CORS_ALLOWED_ORIGINS` as exact origins. Prefer `/api` reverse-proxying on the frontend origin. `DEFAULT_STELLAR_NETWORK` defaults to testnet; `HORIZON_TESTNET_URL` and `HORIZON_MAINNET_URL` configure read-only Horizon endpoints.
- `GET /api/_healthcheck` is process liveness only; it does not establish database readiness. Production monitoring should check database connectivity separately.
- Back up PostgreSQL, exercise restore procedures, restrict DB network access, and run migrations with an appropriately privileged deployment identity. No backup/restore or production deployment exercise has been performed here.
- Never submit real payments from automated tests. Mock Horizon or use testnet fixtures.

## 8. Phased implementation and verification

The approved implementation sequence is complete through the parity-documentation phase. Use the following validation matrix for future changes and release qualification:

| Phase | Deliverable | Required tests |
|---|---|---|
| 1. Server, PostgreSQL and migrations | Express entry point, DB layer, SQL migrations and admin seed | Health/error HTTP tests; schema/index/FK tests; run migration twice; duplicate-preflight fixture must print duplicate rows and abort before unique index; verify the unique constraint rejects duplicates. |
| 2. Wallet authentication | Freighter challenge, SEP-53 verification, session, CSRF, Origin and logout | Valid/invalid signature, wrong wallet/network, expired and replayed challenge, concurrent single-use, session/cookie attributes, CSRF and Origin rejection, logout and logout-everywhere; test rate-limit boundaries. |
| 3. Records, roles, audit and verification | Role-protected CRUD, void history, audits, Horizon verification and cursor routes | Role matrix and ownership per mutation; duplicate hash 409; no-delete void history; audit actions; source/destination/amount/asset mismatch; multi-operation transaction; strict-send; not-found, pending, operation cursor cap; filters before pagination; tampered/filter-mismatched cursor. |
| 4. Frontend API adapter | `src/api.ts` and UI consume self-hosted API pages | Type-check/build; browser test session restore, login/logout, errors, list pagination/filtering and privacy projection; verify no frontend authorization is relied on. |
| 5. Executable scenarios | Map `tests/tests.json` to Vitest/Supertest tests and browser tests where necessary | Maintain a scenario-to-test matrix; run API tests against a disposable PostgreSQL DB; browser/Freighter adapter tests cover SSE fallback, responsive UI, sorting, CSV, loading and empty/error states. |
| 6. Parity and deployment | This design and [route-by-route parity report](./parity-report.md) | Compare every reference route's method/path/body/status/access rules; mark same/intentional/not matched; run PostgreSQL migrations/tests, full suite, build and an HTTPS browser smoke test before any AppDeploy cleanup. |

The executable suite is `npm test` (`Vitest` + `Supertest`); test scripts are defined in `package.json`. Current run: 6 passed, 4 skipped because `TEST_DATABASE_URL` is unset. `npm run typecheck`, `npm run build`, and `npm audit` have passed/reported zero advisories in the current work session. PostgreSQL migration/integration tests and full browser/Freighter journeys remain outstanding. The parity report explicitly identifies these limits.

## 9. Risks and open questions

1. **Existing data:** no AppDeploy database export or platform schema was available. A production migration requires an authorized export, field mapping, duplicate resolution, and a tested import/rollback plan.
2. **Duplicate transactions:** migration 002 deliberately fails and reports duplicates. An operator must decide the canonical record and preserve a documented audit trail before applying it.
3. **Organization identity:** one organization is currently one wallet. Decide whether multi-wallet organizations or wallet rotation are required.
4. **Beneficiary consent:** pseudonymous-by-default behavior is implemented, but explicit consent capture/evidence and retention policy require product/legal review. Consider whether creator wallet should also be hidden publicly.
5. **Account creation and path payments:** operation support is implemented; product owners should confirm whether all these operation types count as disbursements and how sponsored/muxed accounts or revocable assets should be represented.
7. **Roles:** one role per wallet is enforced. Define last-admin protection and role reassignment policy.
8. **Operational readiness:** choose DB backup retention/RPO/RTO, rate-limit policy for public reads, audit retention, challenge/rate-limit cleanup, and a separate DB readiness probe.
9. **Parity gate:** AppDeploy removal remains blocked until the parity report's unmatched items are resolved or explicitly accepted and the required PostgreSQL/browser tests can run.
