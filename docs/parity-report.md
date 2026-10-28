# AidTrace backend parity report

## Scope and verdict

Reference: read-only `origin/main` at `3fd7cc9f3ef98405640ee9fecacf9bbf41633afe`, principally `backend/index.ts`. The table compares its explicit route handlers to the self-hosted Express handlers. It does not treat unknown AppDeploy runtime behavior as equivalent.

**Verdict: API paths are present, but full parity is not demonstrated. Do not remove AppDeploy yet.** Multiple intentional behavior changes are documented below, AppDeploy SDK runtime semantics cannot be confirmed from repository source, and PostgreSQL-backed and browser/Freighter journeys have not been run. Approval is required for intentional public-data and authorization behavior changes where product semantics are affected.

## Route comparison

| Route | Reference behavior | Self-hosted behavior | Parity |
|---|---|---|---|
| `GET /api/_healthcheck` | `200 {ok:true,service:"aidtrace-wallet-api"}` | Same path/body/status; explicit `no-store`. It checks process liveness only. | **Intentionally changed** (cache policy); route response same. |
| `POST /api/auth/challenge` | Public; validates address/network; creates stored random nonce; returns challenge ID, signed message and millisecond expiry; address-keyed limit | Same JSON fields and existing SEP-53 message format; five-minute challenge; exact Origin required; PostgreSQL persistence and explicit error middleware | **Intentionally changed** (Origin, explicit persistence/errors). Hosted SDK effects beyond handler source are not confirmed. |
| `POST /api/auth/verify` | Checks stored one-use challenge and SEP-53 signature; returns session and sets a seven-day Secure/HttpOnly/SameSite=Lax cookie | Same success envelope and cookie policy; uses Stellar SDK; atomic challenge consumption, hashed session/CSRF data, audit event; explicit 401/409/429 behavior | **Intentionally changed** (SDK verifier, atomic DB semantics/audit, explicit errors). |
| `GET /api/me` | Optional session; `{session:null}` or session address/network/role/CSRF/ISO expiry; invalid session clears cookie | Same path and primary JSON shape; role is re-read from DB; `no-store` | **Same** at the application response level. Cookie transport through hosted runtime is unconfirmed. |
| `POST /api/auth/logout` | Optional session; checks CSRF only when session exists; deletes session; returns `{ok:true}` and clears cookie | Same response; Origin always required; marks active session revoked and audits it | **Intentionally changed** (Origin, revocation/history, audit). |
| `POST /api/auth/logout-everywhere` | Any session; reads at most 100 rows, deletes wallet sessions; returns `{ok:true}` | Requires Origin + CSRF; revokes all active wallet sessions in SQL; returns same envelope | **Intentionally changed** (no 100-row limit; revocation instead of delete; stricter Origin/CSRF). |
| `GET /api/transparency` | Public; returns `{records}` from a maximum of 100 stored rows, including beneficiary identifiers; sorted in memory | Same `records` key, with SQL filters, cursor page, `nextCursor`/`hasMore`, facets and pagination headers; pseudonymizes beneficiary by default and removes recipient wallet, tx hash, note and selected verification details unless consent is true | **Intentionally changed** (privacy projection, full-set pagination/filtering, added response keys/headers). |
| `GET /api/beneficiary` | Beneficiary/admin; reads at most 100 records then filters by recipient wallet | Beneficiary/admin; wallet predicate is applied in SQL before filters and cursor pagination | **Intentionally changed** (complete results and server-side scoping/pagination; primary `records` key retained). |
| `POST /api/records` | Organization/admin; validated create; returns `{record}`; may verify a transaction | Same path and `{record}` response (201); validates consent and fields, rejects duplicate `(network,tx_hash)`, checks source wallet against stored organization wallet, stores verification history | **Intentionally changed** (unique hash, privacy consent, source verification, explicit DB transaction). |
| `POST /api/records/:id/verify` | Any signed-in role; checks transaction; returns `{record}` | Same access class and response; Origin + CSRF required; source account required; one-operation matching and bounded Horizon pagination; rate limited and audited | **Intentionally changed** (source/operation semantics, CSRF, explicit audit/cache behavior). |
| `PUT /api/records/:id` | Organization/admin with ownership enforcement; validates and updates; returns `{record}` | Same path and primary response; Origin + CSRF, ownership, conditional concurrency update, uniqueness and verification-history reset/recheck | **Intentionally changed** (CSRF, concurrency and database guarantees). |
| `POST /api/records/:id/void` | Organization/admin with ownership enforcement; preserves void record and reason; returns `{record}` | Same path and response; additionally requires a meaningful reason, stores actor/time, uses atomic DB update, requires Origin + CSRF | **Intentionally changed** (explicit void metadata and stricter controls). |
| `GET /api/admin/roles` | Admin; returns `{roles}` with role/address/update data; bounded to 100 | Same `{roles}` collection and role fields; includes reference `id`; adds cursor/filter metadata and SQL pagination | **Intentionally changed** (pagination/filtering; `id` retained for compatibility). |
| `POST /api/admin/roles` | Admin; `{address,role}`; returns `{ok:true}` | Same path/response, with CSRF token in body; transactional role write and audit; prevents self-demotion | **Intentionally changed** (CSRF, audit, atomic persistence). |
| `DELETE /api/admin/roles/:address` | Admin; removes explicit role; returns `{ok:true}` | Same path/response; CSRF in DELETE JSON body, transaction and audit; protects active admin from removing own role | **Intentionally changed** (CSRF, audit and self-removal guard). |
| `GET /api/audit` | Admin; returns `{entries}` sorted in memory from at most 100 events | Same collection key, SQL filters and cursor pagination; adds `nextCursor`/`hasMore` and page headers | **Intentionally changed** (complete result pagination/filtering). |

The new API implements all 16 method/path pairs found in the reference backend. The response bodies preserve their principal existing collection/object keys; list responses deliberately add pagination fields and transparency facets. Unknown local paths return `404 {error:"Route not found."}`.

## Cross-cutting behavior

| Concern | Reference evidence | Self-hosted behavior | Parity |
|---|---|---|---|
| Challenge signing | Existing `AidTrace wallet login` SEP-53 message binds address, network, nonce and expiry; there is no domain line | Message format retained as approved; Stellar SDK verifies the SEP-53 digest; nonce is one-use and five-minute | **Same** message format; **intentionally changed** verification library and DB atomicity. |
| Authorization | Role defaults to donor; protected route checks occur in the handler | Server-side role and owner checks remain; beneficiary access is wallet scoped; any authenticated role may trigger verification | **Same** at route-level policy for observed routes; persistence semantics differ. |
| CSRF / Origin | Custom `originAllowed` permits no-Origin requests; route coverage is uneven; no explicit CORS middleware in the handler | Exact configured allowlist, credentialed CORS, explicit preflight; protected writes and auth POSTs require Origin; writes require session-bound CSRF | **Intentionally changed** (stricter policy). |
| Rate limits | Challenge 8/15m per address, signature verify 12/min per address, record verify 30/min per wallet | Keeps those limits and adds 60 writes/min per wallet; rate keys are hashed and increments atomic in Postgres | **Intentionally changed**. General public read/per-IP limits are still absent. |
| Cache policy | Explicit `no-store` on selected auth/private responses; others have no explicit handler cache policy | API handlers set `Cache-Control: no-store`; list endpoints expose pagination metadata | **Intentionally changed**; runtime-added headers are not confirmed. |
| Verification | Transaction success and payment fields; up to 200 operations; does not bind source to org wallet; separate-history table absent | Checks source and one operation's complete fields; supports operation pages, strict-send destination semantics and verification history; verified/mismatch cache lifetime is one hour | **Intentionally changed**. |
| Identifiers/timestamps/DB | Handler calls AppDeploy `db` without repository schema; relies on platform for storage behavior | Explicit random IDs, PostgreSQL schema, SQL timestamps and migrations | **Not matched / reference UNCONFIRMED** for platform-generated IDs, timestamps, persistence guarantees, transaction isolation and index behavior. |
| Error mapping | Uses imported AppDeploy `error()` and `json()` helpers; helper serialization is external | Express returns `{error:string}`, explicit status codes, malformed JSON 400, oversized body 413, unknown route 404 | **Not matched / reference UNCONFIRMED** for exact hosted error body/header behavior. |
| CORS, cookies, transport | Handler manually reads/sets cookie headers and has custom Origin checks; SDK hosting behavior is outside the repo | Cookie and credentialed CORS are explicit in Express; browser behavior still needs E2E proof | **Not matched / runtime UNCONFIRMED** until deployed browser tests run. |

## Test evidence and remaining work

Executed during this implementation session:

- `npm run typecheck` — passed.
- `npm test` — 6 passed, 4 skipped. The skipped tests require `TEST_DATABASE_URL`; no local PostgreSQL service was available.
- `npm run build` — passed (Vite frontend and TypeScript backend).
- `npm audit` — reported 0 vulnerabilities.
- `git diff --check` — passed for the cursor implementation before documentation updates; will be rerun for this report.
- Mocked Horizon tests covered matching and mismatching source/payment fields, strict-send destination fields, not-found, operation pagination and pending on the page limit.
- Supertest covered health, missing/untrusted Origin, protected-route 401, malformed JSON, CORS preflight and session/security behavior where DB is not required.
- A Stellar keypair fixture confirmed valid SEP-53 signature acceptance and altered/invalid signature rejection.

Not executed / parity not established:

- PostgreSQL migrations, migration duplicate-preflight against actual duplicate rows, and four DB-backed HTTP integration tests.
- Browser/Freighter sign-in, actual Secure cookie persistence, session restore/logout through a browser, SSE activity, responsive UI, filters/sorting, CSV export and empty/loading/error views.
- A deployed AppDeploy-vs-Express request comparison or verification against the AppDeploy hosted runtime.
- AppDeploy database export/import, production backup/restore, or multi-instance deployment.

`tests/tests.json` remains a manual/UI scenario catalog. `tests/backend.test.ts` covers signature verification, origin/authorization, CORS/JSON parsing, Horizon payment comparison/pagination, auth/session behavior, DB-backed record uniqueness and source verification, public filtering/redaction/pagination, ownership, voids, roles and logout-everywhere. The four DB-dependent test cases are skipped when the configured test DB is absent.

## Removal gate

Do not delete `backend/index.ts`, AppDeploy imports/declarations, package references, or README mentions until:

1. The four skipped PostgreSQL integration tests and both migrations pass against a disposable configured PostgreSQL database, including a duplicate-preflight fixture.
2. Browser-level Freighter/session-cookie and UI parity checks have been run or their differences explicitly approved.
3. Every intentional behavior change in this report—especially default public redaction, source-wallet verification, strict CSRF/Origin, and new pagination envelopes—is accepted.
4. The user approves proceeding with AppDeploy removal.

At this checkpoint, the gate is **not met**. AppDeploy references remain intentionally. No push has been made.
