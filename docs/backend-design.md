# AidTrace self-hosted backend design

**Status:** design for review only. No backend implementation is authorized by this document.

## Evidence and scope

The local backend and frontend were inspected at the `remove-appdeploy` branch's parent commit (`5671a3e`). The read-only backend reference is `origin/main` at `3fd7cc9f3ef98405640ee9fecacf9bbf41633afe`, read with `git show origin/main:backend/index.ts`. The UI is not treated as a verified reference: its tail was reconstructed, and no browser journey was run. Route behavior below is what the checked-in handler expresses; platform behavior that cannot be observed in this repository is labelled **UNCONFIRMED**.

The proposed direction is a Node 20+ HTTP API, SQLite for local development and PostgreSQL in production, with versioned SQL migrations. Keep the existing `/api` paths and JSON envelopes where noted. Run the frontend and API on one origin in production where possible; use a same-site reverse proxy for `/api`.

## 1. Implemented vs proposed

“Implemented” means explicit application code exists, not that the hosted runtime, database durability, or end-to-end behavior has been independently verified.

| Feature | Status | Evidence and observed behavior |
|---|---|---|
| Vite/React application shell and wallet/API client calls | PARTIAL | `src/App.tsx` contains UI and calls; its formerly truncated tail was reconstructed. Browser behavior and parity with an original UI are **UNCONFIRMED**. |
| Backend HTTP route declarations | IMPLEMENTED | `backend/index.ts`, exported `handler=router({...})`, declares the routes in §3. Actual router dispatch, body parsing limits, 404/405 behavior, and error serialization are **UNCONFIRMED**. |
| Persistent database tables/schema/migrations | UNCONFIRMED | Application code names six AppDeploy tables and calls `db`; no schema, migration, database configuration, or database integration test exists in the repository. The README claim of persistent storage is not independent evidence of platform durability. |
| Challenge issuance and Freighter signing | IMPLEMENTED | `/api/auth/challenge` generates a 32-byte random nonce and stores the message; `connectWallet` signs that message through Freighter. The message binds AidTrace, address, network, nonce, expiry and purpose, but has no explicit application domain/origin. |
| Server-side SEP-53 signature verification | PARTIAL | `verifySep53` manually decodes the StrKey, builds an Ed25519 public key, hashes `Stellar Signed Message:\n` plus the message, and calls Node crypto. It does not use `@stellar/stellar-sdk`; no signature fixture or Freighter interoperability test is present. |
| Session cookie and CSRF token | PARTIAL | Verify creates a random token, stores its SHA-256 hash as the session key, returns an HttpOnly/Secure/SameSite=Lax seven-day cookie, and returns a CSRF token. The CSRF value is stored directly in the database row and returned by `/api/me`. Storage, cookie forwarding and browser credential behavior are **UNCONFIRMED**. |
| Logout and logout-everywhere | PARTIAL | Single logout deletes the current session. Logout-everywhere reads only the first 100 sessions, then filters by wallet; it can miss sessions beyond that page. Sessions have no `revoked_at`. |
| Role checks | PARTIAL | `roleFor` defaults to donor and protected write/admin routes check roles. Record verification requires any authenticated session, with no ownership or role restriction. Effective access therefore differs from the README permission table. |
| Record validation and CRUD | PARTIAL | `validateRecord`, create/edit/void routes validate fields and preserve voided records. There is no transaction-hash duplicate check or database uniqueness declaration. Database concurrency and persistence semantics are **UNCONFIRMED**. |
| Stellar Horizon verification | PARTIAL | `checkTransaction` checks the selected network's transaction, success flag and up to 200 operations, then matches destination, amount, asset and issuer. It does not compare the payment source to an organization wallet; strict-send destination amount/asset fields are not correctly modeled; pagination beyond 200 operations is absent. |
| Verification caching/history | PARTIAL | A verification object is embedded on the aid record; non-pending results are reused for one hour. No separate history table exists; cache write failure handling and concurrent checks are **UNCONFIRMED**. |
| Rate limiting | PARTIAL | Fixed time buckets exist only for challenge (8 / 15 minutes per address), signature verify (12 / minute per address), and record verify (30 / minute per wallet). Atomicity, conflict behavior and storage guarantees of the SDK calls are **UNCONFIRMED**; other routes have no application limit. |
| Audit events | PARTIAL | `log` writes authentication, logout-everywhere, record create/edit/void/verification, and role add/remove events. Single logout, challenge issuance, failed attempts, and many errors are not logged. The log is not tamper-evident and stores some user-provided text in summaries. |
| List pagination and filtering | PARTIAL | `listAll` reads a maximum of 100 rows; transparency and audit sort that bounded set in memory, beneficiary filters only after reading it, and role/audit UI filtering is client-side. |
| Cache/CORS/Origin controls | PARTIAL | The application sets `Cache-Control: no-store` on cookie responses, `/api/me`, beneficiary, roles and audit reads. Other responses have no explicit cache policy. `originAllowed` is custom, permits requests with no Origin, and is not CORS middleware. SDK CORS/preflight behavior is **UNCONFIRMED**. |
| Public beneficiary-data minimization | PARTIAL | Public transparency returns stored records, including recipient name, wallet, note and creator fields. Consent, redaction and a field allowlist are absent. |
| Admin bootstrap, environment template and deployment migrations | PROPOSED | There is no bootstrap script, `.env.example`, database setup, backend start script, or deployment documentation for a self-hosted API. |
| Executable tests | PROPOSED | `tests/tests.json` is a collection of scenario descriptions, not an executable test suite. `package.json` has no test script. |

### Actual helpers and persistence calls

The following are custom functions in `backend/index.ts`: `validPublicKey` / `publicKeyBytes` (manual Stellar StrKey decoding and checksum validation), `signatureBytes`, `verifySep53`, `cookieFrom`, `responseCookie` / `noStore`, `originAllowed`, `rateLimit`, `roleFor`, `currentSession`, `csrfOK`, `requireSession`, `roleError`, `log`, `listAll`, `cleanText`, `validDate`, `canonicalAmount`, `validateRecord`, `ownedRecord`, and `checkTransaction`.

`backend/index.ts` imports `router`, `json`, `error`, and `db` from `@appdeploy/sdk`:

| AppDeploy SDK symbol/call | Use in application code | What is not established by this repository |
|---|---|---|
| `router({...})` | Wraps method/path handlers and supplies `{body,event,params}`. | Server startup/hosting, route precedence, request-size limits, default CORS, 404/405, exception mapping and header serialization. |
| `json(data,status?)` | Builds JSON responses; `error(message,status)` builds error responses. | Exact error JSON shape, content-type, default status/cache headers, and whether thrown errors are sanitized/logged. |
| `db.get(table, ids, options)` | Reads sessions, challenges, roles, records and rate-limit rows by key; some reads request `{consistent:true}`. | Backing engine, consistency guarantees, transaction isolation, key/index layout and persistence guarantees. |
| `db.tx.add(table, rows)` | Inserts challenges, sessions, records, audit events, roles, and initial rate-limit buckets. | Uniqueness/conflict semantics and atomicity. |
| `db.tx.update(table, updates, {patch:true})` | Conditional updates for challenge consumption, rate limits, record edits/voids and role updates. | Whether the `if` predicate is atomic or compare-and-swap under concurrency. |
| `db.update(table, updates)` | Writes verification results and post-verification record state. | Atomicity and error behavior. |
| `db.delete(table, ids)` | Removes a session on logout and role rows on role removal. | Transactional semantics and delete result shape. |
| `db.list(table,{limit})` | Loads at most 100 records for `listAll`. | Ordering, cursor support and whether the limit is stable across concurrent inserts. |

`src/App.tsx` imports `api` from `@appdeploy/client`; `src/appdeploy-client.d.ts` is a local hand-written type stub, not the package implementation. Calls are `api.get` for `/api/transparency`, `/api/beneficiary`, `/api/audit`, `/api/me`, `/api/admin/roles`; `api.post` for challenge, signature verify, logout, logout-everywhere, record create, record verify, record void, and role assignment; `api.put` for record edit; and `api.delete` for role removal. The UI expects responses under `.data`. Cookie credentials, base URL selection, JSON conversion, error conversion, and cross-origin behavior of this client are **UNCONFIRMED**. The UI also calls Horizon directly with `fetch` and `EventSource` for account activity.

AppDeploy is not responsible for all behavior visible in the handler: IDs are created with Node `randomBytes`; timestamps use `Date.now()` / `new Date().toISOString()`; the cookie is manually set and parsed; CSRF and Origin checks are custom code; and table names, validation, roles and route responses are application code. The actual durable database, router runtime, framework CORS, cookie transport, and deployment environment are not specified locally. `package.json` does not declare either AppDeploy package, and `tsconfig.json` includes `src` only, not `backend`.

## 2. Proposed data model

Use migrations rather than SDK-created implicit collections. Store all timestamps in UTC (SQLite: ISO-8601 `TEXT`; PostgreSQL: `TIMESTAMPTZ`). Store token-derived secrets as hashes; store exact display amounts as integer stroops (`BIGINT`/SQLite `INTEGER`) to avoid floating-point comparisons. Application validation remains authoritative for Stellar encodings.

| Table | Columns and types | Constraints and indexes | Existing behavior preserved / design notes |
|---|---|---|---|
| `users` | `wallet_address TEXT`, `created_at TIMESTAMP`, `last_authenticated_at TIMESTAMP NULL` | PK `wallet_address`; address validated as a Stellar G-address by service code. | One identity per authenticated wallet; no passwords or signing keys. |
| `wallet_roles` | `wallet_address TEXT`, `role TEXT`, `updated_by TEXT`, `updated_at TIMESTAMP` | PK/FK `wallet_address -> users`; role CHECK in `donor`, `organization`, `beneficiary`, `admin`; FK `updated_by -> users`; index `(role,wallet_address)`. | One explicit role per address as today; no row means donor. Admin grant/removal remains audited. |
| `organizations` | `wallet_address TEXT`, `display_name TEXT`, `created_at TIMESTAMP`, `updated_at TIMESTAMP` | PK/FK `wallet_address -> users`; unique normalized display name only if product requires it. | Stores the organization wallet explicitly. For this design, the signing/authorized organization wallet is the expected payment source. Creation is tied to an admin-assigned organization role; this one-wallet-per-organization rule needs approval. |
| `sessions` | `session_hash TEXT`, `wallet_address TEXT`, `network TEXT`, `csrf_token_hash TEXT`, `created_at TIMESTAMP`, `expires_at TIMESTAMP`, `revoked_at TIMESTAMP NULL`, `last_seen_at TIMESTAMP NULL` | PK `session_hash`; FK wallet; CHECK network; index `(wallet_address,revoked_at,expires_at)` and expiry cleanup index. | Preserve seven-day sessions and role lookup on each request. Cookie contains a random 32-byte token; only its SHA-256 hash is stored. Compare a submitted CSRF token by hash; revoke rather than delete. |
| `challenges` | `challenge_id TEXT`, `nonce TEXT`, `wallet_address TEXT`, `network TEXT`, `domain TEXT`, `signed_message TEXT`, `created_at TIMESTAMP`, `expires_at TIMESTAMP`, `used_at TIMESTAMP NULL` | PK `challenge_id`; UNIQUE `nonce`; FK wallet; CHECK network; index `(wallet_address,expires_at,used_at)`. | Preserve unpredictable, five-minute, one-use challenges and network binding. Atomically set `used_at` only if null and not expired. Persist the exact signed message for verification. |
| `aid_records` | `id TEXT`, `organization_wallet TEXT`, `recipient_name TEXT`, `recipient_wallet TEXT`, `purpose TEXT`, `amount_stroops BIGINT`, `asset_code TEXT`, `asset_issuer TEXT NULL`, `network TEXT`, `tx_hash TEXT NULL`, `disbursement_date DATE`, `note TEXT`, `status TEXT`, `created_by TEXT`, `created_at TIMESTAMP`, `updated_at TIMESTAMP NULL`, `void_reason TEXT NULL`, `voided_by TEXT NULL`, `voided_at TIMESTAMP NULL`, `beneficiary_consent_at TIMESTAMP NULL`, `consent_version TEXT NULL` | PK `id`; FK organization to `organizations`; FK creator/voider to users; CHECK amount > 0, network/status values, issuer rules and all-or-none void fields; UNIQUE `(network,tx_hash)` (NULL means no hash); indexes `(created_at,id)`, `(organization_wallet,created_at,id)`, `(recipient_wallet,created_at,id)`, `(network,status,disbursement_date,id)`. | Keep current record fields and void-in-place history. Store `tx_hash` lower-case; API keeps the existing `txHash` response key and maps NULL to `""`. Current status type omits runtime `pending`; new constraint must include it. Do not mix organization display identity with its wallet. Consent columns are proposed; current code has no consent mechanism. |
| `verification_results` | `id TEXT`, `aid_record_id TEXT`, `status TEXT`, `differences_json TEXT`, `reason TEXT NULL`, `ledger BIGINT NULL`, `transaction_created_at TIMESTAMP NULL`, `source_account TEXT NULL`, `destination TEXT NULL`, `amount_stroops BIGINT NULL`, `asset_code TEXT NULL`, `asset_issuer TEXT NULL`, `checked_at TIMESTAMP`, `cache_expires_at TIMESTAMP NULL` | PK `id`; FK record; status CHECK `verified`, `mismatch`, `not-found`, `unverified`, `pending`; indexes `(aid_record_id,checked_at,id)` and `(status,checked_at)`. | Preserve one-hour caching using the latest result and leave history for auditing. Add the source field for the organization-wallet comparison. API can still expose the latest verification under the existing record JSON field. |
| `rate_limits` | `key_hash TEXT`, `window_start TIMESTAMP`, `count INTEGER`, `expires_at TIMESTAMP` | PK `(key_hash,window_start)`; CHECK count >= 0; expiry index. | Preserve fixed-window per-address/wallet limits without storing raw identifiers in the key. Increment with a single atomic conditional upsert in a DB transaction. |
| `audit_events` | `id TEXT`, `action TEXT`, `actor_wallet TEXT NULL`, `subject_wallet TEXT NULL`, `record_id TEXT NULL`, `summary TEXT`, `metadata_json TEXT`, `created_at TIMESTAMP` | PK `id`; optional FKs; indexes `(created_at,id)`, `(actor_wallet,created_at,id)`, `(record_id,created_at,id)`, `(action,created_at,id)`. | Preserve current audit actions, add challenge/session/security events and actor/time/object context. App DB role should have INSERT/SELECT but not UPDATE/DELETE. Avoid putting beneficiary names, notes, signatures, cookies or nonces in summaries/metadata. |

SQLite should enable foreign keys on every connection. PostgreSQL uses corresponding `TEXT`, `BIGINT`, `DATE`, `TIMESTAMPTZ`, and `CHECK`/FK constraints. Keep migrations portable and verify each against both engines. Introduce a `schema_migrations` table maintained by the migration runner.

### Transaction-hash uniqueness migration

Do not silently delete or merge aid records. Before normalizing data or creating the unique index, the migration runner must print duplicate row IDs and abort if this preflight returns any rows:

```sql
SELECT id, network, tx_hash, duplicate_count
FROM (
  SELECT id, network, tx_hash,
         COUNT(*) OVER (PARTITION BY network, LOWER(tx_hash)) AS duplicate_count
  FROM aid_records
  WHERE tx_hash IS NOT NULL AND TRIM(tx_hash) <> ''
) duplicates
WHERE duplicate_count > 1
ORDER BY network, LOWER(tx_hash), id;
```

An operator must resolve every reported duplicate explicitly, retaining audit history. If the query is empty, the migration can normalize empty hashes and case, then apply the constraint/index:

```sql
UPDATE aid_records SET tx_hash = NULL WHERE TRIM(tx_hash) = '';
UPDATE aid_records SET tx_hash = LOWER(tx_hash) WHERE tx_hash IS NOT NULL;
CREATE UNIQUE INDEX ux_aid_records_network_tx_hash
  ON aid_records(network, tx_hash);
```

SQLite and PostgreSQL permit multiple NULL values in a unique index. The runner must execute the preflight before the updates/index in both engines and fail with the duplicate list; application validation must lowercase hashes on every create and edit. Whether historical duplicates should be voided, marked duplicate, or retained with one canonical record is an operator/product decision, not a migration guess.

## 3. API routes

Keep the current paths and JSON envelopes for existing routes. Add query parameters for server-side filtering and keyset pagination. For compatibility, keep the current `{records}`, `{entries}`, and `{roles}` response bodies; send an opaque `nextCursor` in `X-Next-Cursor`, `X-Has-More`, and a standard `Link: <...>; rel="next"` header. CORS must expose these headers. Stable keyset order is `(created_at,id)` for records/audit, and `(wallet_address)` for roles. A default page size of 50 and maximum of 100 are proposed page sizes, not an overall 100-row data cap.

Error body shape produced by AppDeploy's imported `error()` helper is **UNCONFIRMED**. The status codes below are the explicit codes in route code; unhandled SDK/database failures have no documented status/body.

| Method / path | Status | Auth / role | CSRF / Origin | Rate limit | Request → success response | Explicit errors and caching |
|---|---|---|---|---|---|---|
| `GET /api/_healthcheck` | existing | Public | None | None | None → `200 {ok:true,service:"aidtrace-wallet-api"}` | No explicit cache header; proposed `Cache-Control: no-store`. |
| `POST /api/auth/challenge` | existing / changed message | Public | Origin check; no CSRF | 8 / 15 min per address | `{address,network}` → `200 {challengeId,message,expiresAt}`. Add configured domain to signed message without changing envelope. | `400` invalid address/network; `403` Origin rejected; `429` limit; `503` DB insert failure. No explicit cache header; proposed `no-store`. |
| `POST /api/auth/verify` | existing / changed verifier | Public | Origin check; no CSRF | 12 / min per address | `{challengeId,address,network,signature}` → `200 {session:{address,network,role,csrfToken,expiresAt}}`; set session cookie. Verify with Stellar SDK and consume challenge atomically. | `400` malformed request; `401` expired/used/mismatched challenge or bad signature; `403` Origin; `409` concurrent replay; `429`; `503` session storage. Current cookie response is `no-store`. |
| `GET /api/me` | existing | Session optional | None | None | None → `200 {session:null}` or current `{session:{address,network,role,csrfToken,expiresAt}}`. | Invalid/expired session returns null and clears cookie. Current response is `no-store`. |
| `POST /api/auth/logout` | existing / changed enforcement | Session optional | Existing: CSRF only if session exists; no Origin check. Proposed: enforce allowed Origin on browser requests. | None | `{csrfToken}` → `200 {ok:true}`; revoke current session and clear cookie. | `403` CSRF when an active session has a mismatch. Current response is `no-store`. |
| `POST /api/auth/logout-everywhere` | existing / changed persistence | Required; any role | Origin + CSRF | None | `{csrfToken}` → `200 {ok:true}`; revoke every active session for wallet, not only the first 100. | `401` expired session; `403` Origin/CSRF. Current response is `no-store`. |
| `GET /api/transparency` | existing / changed query | Public | None | Proposed per-IP read limit | Existing response `{records:[...]}`. Add `q`, `organization`, `asset`, `network`, `status`, `from`, `to`, `sort`, `direction`, `limit`, `cursor`; filter/order/page in SQL before returning. | No explicit current cache header. Proposed short public cache (`max-age=30`) only after PII/publication policy; otherwise `no-store`. Keep response envelope; pagination headers above. |
| `GET /api/beneficiary` | existing / changed query | Required: beneficiary or admin | Session cookie; no CSRF | Proposed per-wallet read limit | Existing `{records:[...]}`. Add optional date/status filters, `limit`, `cursor`; always constrain by session wallet in SQL. | `401` no/expired session; `403` wrong role. Current response is `no-store`; keep it. Pagination headers above. |
| `POST /api/records` | existing / changed validation | Required: organization or admin | Origin + CSRF in body | Proposed per-wallet write limit | Existing body fields plus `csrfToken`; `201 {record}`. Create uses authenticated organization wallet, then verify if hash supplied. Reject duplicate `(network,tx_hash)` with `409`. | `400` invalid input; `401`; `403` role/Origin/CSRF; `409` duplicate; `503` storage failure. Proposed `no-store`. |
| `POST /api/records/:id/verify` | existing / changed verification | Existing: any session; keep any authenticated role so public records can be rechecked | Origin + CSRF | 30 / min per wallet | `{csrfToken}` → `200 {record}` with cached or refreshed verification. Compare one matching operation including organization source. | `401`; `403`; `404`; `429`; Horizon errors represented as `pending` within a successful `200`. Current response has no explicit cache header; proposed `no-store`. |
| `PUT /api/records/:id` | existing / changed validation | Required: organization owner or admin | Origin + CSRF in body | Proposed per-wallet write limit | Existing full record fields plus CSRF → `200 {record}`. Preserve organization and creator; clear/recompute verification when relevant fields change. | `400`; `401`; `403` role/Origin/CSRF/owner; `404`; `409` voided or concurrent update (and duplicate tx); `503` DB. Proposed `no-store`. |
| `POST /api/records/:id/void` | existing / changed persistence | Required: organization owner or admin | Origin + CSRF | Proposed per-wallet write limit | `{csrfToken,reason}` → `200 {record}` with immutable void reason, actor and timestamp; do not delete. | `400` invalid reason; `401`; `403`; `404`; `409` already voided/concurrent update. Proposed `no-store`. |
| `GET /api/admin/roles` | existing / changed query | Required: admin | Session cookie; no CSRF | Proposed per-admin read limit | Existing `{roles:[...]}`; add optional role/address filters, `limit`, `cursor`. | `401`; `403`; current `no-store`. Pagination headers above. |
| `POST /api/admin/roles` | existing | Required: admin | Origin + CSRF | Proposed per-admin write limit | Existing `{csrfToken,address,role}` → `200 {ok:true}`. Keep the same envelope; organization metadata is configured through the new organization route. | `400`; `401`; `403`; `409` self-demotion/concurrent role change; `503` DB. Proposed `no-store`. |
| `DELETE /api/admin/roles/:address` | existing | Required: admin | Origin + CSRF in DELETE body | Proposed per-admin write limit | `{csrfToken}` → `200 {ok:true}`; remove explicit role, preserve audit event. | `400`; `401`; `403`; `404`; `409` self-removal; `503` DB. Proposed `no-store`. |
| `GET /api/audit` | existing / changed query | Required: admin | Session cookie; no CSRF | Proposed per-admin read limit | Existing `{entries:[...]}`; add `action`, `q`, `from`, `to`, `limit`, `cursor`; filter/page in DB. | `401`; `403`; current `no-store`. Pagination headers above. |
| `GET /api/admin/organizations` | new | Required: admin | Session cookie; no CSRF | Proposed per-admin read limit | Query `q`, `limit`, `cursor` → `{organizations:[...]}` and pagination headers. | `401`; `403`; `no-store`. |
| `PUT /api/admin/organizations/:address` | new | Required: admin | Origin + CSRF | Proposed per-admin write limit | `{csrfToken,displayName}` → `{organization}`; only for an address with explicit organization role. | `400`; `401`; `403`; `404` if no organization role; `409` name conflict; `no-store`. |

Use parameterized SQL for every filter. Validate sort keys against a fixed allowlist; never interpolate arbitrary sort or filter values into SQL. Cursor tokens must be opaque, versioned and bound to the normalized filter/order set so a cursor cannot be reused with a different query. Request `limit` is clamped, not trusted. Apply authorization predicates in SQL, before pagination.

## 4. Wallet-signature authentication flow

1. The browser asks Freighter for the public address and network; it never receives or transmits a seed phrase or private key.
2. `POST /api/auth/challenge` validates address/network and returns a random challenge identifier, exact message and expiry. Generate at least 32 cryptographically random bytes for the nonce; store the nonce and message with `expires_at = created_at + 5 minutes`, `used_at = NULL`.
3. Freighter signs the exact UTF-8 message below with SEP-53. Build the domain from configured `PUBLIC_APP_ORIGIN` (canonical origin), not an untrusted request `Host` header:

   ```text
   AidTrace wallet login
   Domain: https://aidtrace.example
   Address: G...
   Network: testnet
   Nonce: <64 lowercase hexadecimal characters>
   Issued At: <UTC ISO-8601 timestamp>
   Expires At: <UTC ISO-8601 timestamp, no more than five minutes later>
   Purpose: prove wallet ownership; no transaction will be sent.
   ```

4. `POST /api/auth/verify` loads the stored challenge by ID and checks exact address, network, configured domain, expiry, and unused state. Decode/validate the StrKey and base64 signature with `@stellar/stellar-sdk` (`Keypair.fromPublicKey(address)` and its Ed25519 `verify` support); verify the SEP-53 signed-message digest (`SHA-256(UTF-8("Stellar Signed Message:\n" + exactMessage))`) against the 64-byte signature. Keep a test vector generated by the installed SDK and a Freighter-compatible fixture so the prefix/digest convention is proven rather than assumed.
5. In a database transaction, conditionally set `used_at` only if it is still NULL and the challenge is unexpired, create/update the user, and insert a session. A second concurrent verification must fail. If any part fails, do not return a session cookie.
6. Generate a random 32-byte session token and separate random CSRF token; persist only SHA-256 hashes. Set `aidtrace_session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`. Return only wallet/network/role/expiry and the CSRF token in the HTTPS JSON response. A seven-day absolute expiry is required; role is re-read server-side on each request.
7. On writes, require the session cookie, match the CSRF token hash, and validate Origin. Logout sets `revoked_at` and clears the cookie. Logout-everywhere revokes all unexpired sessions for that wallet in one DB statement/transaction; do not page through a bounded arbitrary session list.

The current stored challenge message has no explicit `Domain:` line, and the current verifier is handwritten Node crypto rather than the Stellar SDK. Confirm the signing digest against SEP-53/Freighter during the auth implementation phase before switching the verifier.

## 5. Stellar verification design

Keep the existing selected-network transaction lookup, transaction success check, address/hash validation, amount normalization, destination comparison, asset code and issuer comparison, one-hour success/mismatch cache, and retryable Horizon failure behavior. Configure Testnet and Mainnet Horizon URLs separately; never accept an arbitrary user-supplied URL.

Add these checks before returning `verified`:

- The matching payment operation must have the intended recipient, exact amount, asset code and issuer.
- The source account must equal that record's `organizations.wallet_address`. Use operation-level source (`from`/`funder`) when present; otherwise use the transaction source only when the operation semantics establish that source. Do not infer the payer solely from the transaction envelope when a path operation can specify a different source.
- Compare all fields on one operation. Do not combine a destination match from one operation with an amount/asset match from another.
- For `path_payment_strict_send`, compare the beneficiary's `destination_amount`, `destination_asset_*`, and recipient address; the current code reads `amount`/`asset_code` and can misclassify it. For create-account, compare `account`, `starting_balance`, XLM and `funder`. Keep payment and path-payment operation semantics explicit in fixtures.
- Fetch all relevant operation pages using Horizon cursors. If the maximum safe page budget is reached before determining a match, return `pending` rather than a false mismatch. If any single operation fully matches—including source—then the transaction may be verified even if it contains unrelated operations.

Outcomes exposed through existing record `status`/`verification` JSON:

| Outcome | Meaning |
|---|---|
| `verified` / “Verified on-chain” | Successful transaction has at least one operation matching source organization, destination, amount, asset and issuer on the selected network. It does not establish identity, consent, intended use or impact. |
| `mismatch` / “Mismatch” | Transaction exists but is unsuccessful or no single operation matches one or more required fields. Include field-level differences without exposing unrelated account data. |
| `not-found` / “Not found” | Horizon returns 404 for the hash on the selected network; malformed hashes should be rejected as `400` on record write, not recorded as a false on-chain result. |
| `unverified` / “Unverified” | No transaction hash was supplied. |
| `pending` / “Checking…” | Horizon is unavailable, rate-limited, malformed, incomplete or exceeded bounded pagination. Do not cache as final; it is retryable. |
| `voided` / “Voided” | Record is administratively voided; preserve the last verification evidence and void history, but never present it as an active verified record. |

Current code checks `successful`, treats an unsuccessful transaction as mismatch, returns not-found for a Horizon 404, and returns pending for network/non-OK failures. It does not currently enforce source-account match or fully handle strict-send path fields. Its type alias `Status` omits `pending` even though code returns it; include `pending` in the replacement backend type and DB constraint.

## 6. Security requirements

- Enforce the README role matrix at the API boundary for every route. Donor defaults to read-only public data and own wallet activity; beneficiary reads only records for its wallet; organization creates and edits/voids only its own records; admin manages roles, organizations and audit. Keep verification limited to an authenticated session unless product approval changes this behavior. UI hiding is not authorization.
- Require CSRF validation and exact allowed Origin on every cookie-authenticated state-changing route, including logout. Reject unexpected/missing browser Origin; do not use `Origin`/`Host` supplied by the request as the configured trusted domain. CORS allowlist must be exact origins, never `*` with credentials.
- Use HttpOnly, Secure, SameSite=Lax cookies in production. Prefer same-origin reverse proxy or frontend/backend subdomains under the same registrable site so Lax works. If deployment is cross-site, pause for an explicit decision: `SameSite=None; Secure` is necessary and changes the stated Lax requirement. For credentialed CORS send a specific `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials: true`, `Vary: Origin`, and expose pagination headers.
- Keep existing auth rate limits and add general per-IP/per-wallet read/write limits. Store only hashed rate-limit keys; use atomic UPSERT/conditional increment, not a read-then-write susceptible to lost updates. Return 429 consistently and test concurrent requests.
- Validate all fields at the API boundary: strict Stellar public key/checksum, 64-hex transaction hash, supported network, positive integer stroops bounded to signed 64-bit, asset/issuer consistency, valid calendar date, text lengths, allowed role/status, cursor/order/filter allowlists. Use parameterized DB queries and DB constraints.
- Audit role changes, session creation/revocation, record create/edit/void, verification refresh, admin bootstrap, and security-relevant rejection events without logging secrets, signatures, session cookies, CSRF tokens, full challenge messages/nonces, or unnecessary beneficiary PII. Database credentials for the app should deny audit UPDATE/DELETE.
- Admin bootstrap is a one-shot/idempotent local/operations seed command that reads `ADMIN_WALLET`, validates a public G-address, and inserts the admin role. No public admin-bootstrap route. Do not accept private keys or seed phrases.
- Minimize beneficiary PII. The current public endpoint returns full records, including `recipient`, `recipientAddress`, `note`, and `createdBy`; consent and redaction are absent. Proposed: store the wallet privately for verification and expose a consent-controlled public projection while retaining the existing record object keys (redacted/pseudonymous values where consent is absent). Require documented consent before publishing an identifiable name/address; do not store identity documents. The precise public projection requires product approval in §9.
- Keep secrets in environment/secret manager only; do not expose secrets through `VITE_*`, source maps, logs or committed `.env`. Lock dependencies, run audit, and avoid logging request bodies. Restrict PostgreSQL network access and apply least-privilege app/migration DB roles.

## 7. Deployment requirements

- Runtime: Node.js 20+; TypeScript API compiled for production, with a development runner. Backend gets its own TypeScript configuration; current `tsconfig.json` only includes `src`.
- Database: SQLite file for local development; PostgreSQL for production. A `DATABASE_URL` selects the backend. Create a portable migration set and test against both engines. SQLite connections must enable FK enforcement; PostgreSQL uses a migration-only privileged role and a least-privilege runtime role.
- Add `.env.example` with placeholders only, for example:

  ```dotenv
  NODE_ENV=development
  PORT=3001
  DATABASE_URL=file:./data/aidtrace.db
  PUBLIC_APP_ORIGIN=http://localhost:5173
  CORS_ALLOWED_ORIGINS=http://localhost:5173
  DEFAULT_STELLAR_NETWORK=testnet
  HORIZON_TESTNET_URL=https://horizon-testnet.stellar.org
  HORIZON_MAINNET_URL=https://horizon.stellar.org
  ADMIN_WALLET=
  ```

- Do not commit populated `.env` files. Production `PUBLIC_APP_ORIGIN` must be HTTPS and canonical. Production cookies are always Secure; use local HTTPS for reliable cookie testing or document a development-only localhost exception.
- Host static Vite assets and the Node API behind a same-origin HTTPS reverse proxy where possible (`/api/*` to backend). Separate hosting must configure exact credentialed CORS and same-site cookies; cross-site deployment requires the decision noted above.
- Expose a health endpoint. Keep `/api/_healthcheck` for parity and test DB readiness separately from process liveness. Configure startup to fail clearly if required env vars or migrations are missing.
- Back up PostgreSQL and SQLite according to operator RPO/RTO; test restores and migration rollback/forward procedures. Back up before duplicate resolution or any data import.
- Testnet is the default in development and all automated tests. Mainnet is an explicit production configuration; tests must use Horizon fixtures/mocks or Stellar testnet only and must never submit real transfers.
- Configure Horizon endpoints via environment, bounded request timeouts, retry/backoff for transient failures, and explicit rate-limit handling. Do not let untrusted record data select a URL.

## 8. Phased implementation and tests

1. **Parity contract and test harness.** Capture the route/status/JSON/permission baseline from `origin/main` backend commit `3fd7cc9`; create `docs/parity-report.md` with a row per route and columns for reference behavior, new behavior, test, and parity result. Add Vitest and Supertest; retain test fixtures only (no real funds). Turn `tests/tests.json` into executable case IDs/metadata imported by Vitest, with API tests for auth, record verification, public filtering, and role/audit scenarios. Add Playwright only for browser-specific responsive, Freighter UX and SSE behavior that Supertest cannot exercise.
2. **Schema and migrations.** Build portable migrations for SQLite/PostgreSQL and data access. Test FK constraints, stroop conversion, session/challenge indexes, audit append-only permissions, duplicate preflight reporting, abort behavior, and unique `(network,tx_hash)` enforcement. Do not import data until AppDeploy export access and duplicate resolution are decided.
3. **Auth and server middleware.** Implement router, JSON/error shape, request limits, Origin/CORS, session cookies, CSRF, exact five-minute domain-bound SEP-53 challenge, SDK signature verification, atomic single use, seven-day session, single logout and logout-everywhere. Test valid/invalid signature, wrong address/domain/network, expiry, concurrent replay, cookie attributes, CSRF, Origin, rate limits and session revocation with deterministic keys/fake time.
4. **Roles, records and audit.** Implement server role authorization, org setup, validated CRUD, immutable void history, admin seed, audit events and transaction uniqueness. Use Supertest to assert each role against every mutation, owner boundaries, concurrent writes, duplicate hash conflict, no deletion on void, and no sensitive data in logs/public projections.
5. **Stellar verification.** Mock Horizon at transaction/operations endpoints and test testnet/mainnet routing, 404, failure, timeout, malformed JSON, rate limits, pagination, multiple operations, issuer mismatch, source mismatch, create-account, strict receive/send, cache expiry and pending retry. No production transaction or money transfer.
6. **Cursor queries and frontend integration.** Implement keyset pagination, SQL-side filters/sorts, safe cursors and pagination headers for records, beneficiary records, roles and audit. Verify deterministic pages during concurrent inserts and ensure a beneficiary filter is applied before pagination. Adapt the frontend API helper to same-origin fetch/credentials/header access; run Vite type-check/build and component tests.
7. **Executable journeys, parity and deployment.** Map each scenario in `tests/tests.json` to an executable test. Use Supertest/Vitest for API assertions and browser tests with a deterministic Freighter adapter and mocked Horizon for sign-in, session restore/logout, empty/error/loading states, CSV, filters, mobile viewport and SSE fallback. Run migration tests on both DBs, full test suite, build, and a route-by-route `docs/parity-report.md`; mark every intentional behavior difference and get approval. Only after full parity is demonstrated should AppDeploy imports/files/dependencies/README references be removed.

`docs/parity-report.md` is planned, not present or completed. The baseline must record the original route body/status/access semantics rather than infer them from README prose. Document intentional changes such as stricter domain binding, sender verification, privacy redaction, duplicate rejection and pagination headers.

## 9. Risks and open questions

1. **AppDeploy data migration:** Is there an authorized export of the existing six platform tables and their rows? Their schema/consistency is not available in the repository. Do not assume a lossless export or silently start an empty production DB.
2. **Duplicate transactions:** Who decides which existing records remain canonical when `(network,tx_hash)` duplicates are found? The migration will report and stop; it will not delete/merge records.
3. **Organization identity:** Is one organization exactly one Stellar wallet, or can one organization have multiple authorized wallets? The proposed schema assumes one wallet and compares the payment source with that wallet.
4. **Beneficiary privacy:** Which fields may be public, and is explicit consent required for names, wallet addresses and notes? Existing transparency returns all of them. Decide the public projection before migration/UI parity.
5. **Payment semantics:** Should account creation count as an aid disbursement? For path payments, should verification mean the exact destination amount received (proposed), and how should sponsored accounts, muxed addresses, clawback/revocable assets or multi-recipient transactions be handled?
6. **Auth domain and deployment:** What canonical production app origin and API hosting domains will be used? Same-site reverse proxy preserves the requested Lax cookie; genuinely cross-site hosting needs `SameSite=None` and explicit approval.
7. **Role model:** Preserve exactly one role per wallet (current behavior) or allow multiple roles? How should the last administrator be protected from removal or loss of access?
8. **Admin bootstrap:** Who runs the seed script and supplies `ADMIN_WALLET` in each environment? Confirm whether the same wallet should be admin on Testnet and Mainnet.
9. **Retention/operations:** What are the required audit/session/challenge retention, backup retention, and recovery objectives? Expired challenges/rate-limit buckets need scheduled cleanup.
10. **Testing dependencies:** Approve adding Vitest, Supertest and (for browser-only scenarios) Playwright. Confirm whether an organization-controlled testnet wallet/signature fixture is available; no real funds are needed.

**Approval gate:** No self-hosted backend code, package changes, schema migrations, parity report, or AppDeploy removal should begin until this design is reviewed and approved.
