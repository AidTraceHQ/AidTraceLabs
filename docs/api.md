# API

All API responses are configured with `Cache-Control: no-store`. Error responses use `{ "error": "..." }` (per-IP rate-limit responses also include `"code": "rate_limit_exceeded"`). Protected writes require an allowed `Origin`, an authenticated session, and a valid CSRF token unless noted. List routes use bounded cursor pagination.

| Method and path                    | Access                                        | Purpose                                                         |
| ---------------------------------- | --------------------------------------------- | --------------------------------------------------------------- |
| `GET /api/_healthcheck`            | Public                                        | Process liveness; does not check database readiness.            |
| `POST /api/auth/challenge`         | Public, allowed Origin                        | Create a short-lived wallet challenge.                          |
| `POST /api/auth/verify`            | Public, allowed Origin                        | Verify wallet signature and set session cookie.                 |
| `GET /api/me`                      | Optional session                              | Return current session or `null`.                               |
| `POST /api/auth/logout`            | Optional session, Origin; CSRF when signed in | Revoke current session and clear cookie.                        |
| `POST /api/auth/logout-everywhere` | Authenticated, CSRF                           | Revoke every session for the wallet.                            |
| `GET /api/transparency`            | Public; optional session changes projection   | Filter and page public records and summary/facets.              |
| `GET /api/records/:id`             | Public; optional session changes projection   | Return one record with the same privacy projection as the list. |
| `GET /api/beneficiary`             | Beneficiary or admin                          | Return records scoped to the session wallet and filters.        |
| `POST /api/records`                | Organization or admin, CSRF                   | Create a record and begin verification when a hash is supplied. |
| `PUT /api/records/:id`             | Owning organization or admin, CSRF            | Edit an allowed record.                                         |
| `POST /api/records/:id/void`       | Owning organization or admin, CSRF            | Void a record with a reason; does not delete it.                |
| `POST /api/records/:id/verify`     | Authenticated, CSRF                           | Request a verification check.                                   |
| `GET /api/admin/roles`             | Admin                                         | Filter and page role assignments.                               |
| `POST /api/admin/roles`            | Admin, CSRF                                   | Assign a role.                                                  |
| `DELETE /api/admin/roles/:address` | Admin, CSRF                                   | Remove a role assignment.                                       |
| `GET /api/audit`                   | Admin                                         | Filter and page audit events.                                   |

The transparency query accepts `q`, `organization`, `asset`, `network`, `status`, `from`, `to`, `limit`, and `cursor`. Admin roles accept `role`, `q`, `limit`, and `cursor`; audit accepts `action`, `address`, `recordId`, `q`, `limit`, and `cursor`. The API validates filters and binds signed cursors to their query filters.

List responses include `nextCursor` and `hasMore`. `GET /api/transparency` also includes `total`, the number of records matching the bound filters, independent of `limit` and `cursor`.

Authentication challenge inputs are `{ address, network }`. Signature verification accepts `{ challengeId, address, network, signature }`. Record write fields are validated server-side; mutating request bodies include `csrfToken`.

Record responses may include a `verification` object with the latest check's evidence. When Horizon reports a transaction memo, `verification.memo` holds its value and `verification.memoType` holds one of `text`, `id`, `hash`, or `return`; both are omitted when the transaction has no memo (`none`) or the result did not reach a transaction (`not-found`, `pending`, `unverified`). An `id` memo is a uint64 returned as a decimal string, and `hash`/`return` memos keep Horizon's base64 encoding. The memo is capture-only evidence for reconciliation and never affects whether a record is `verified` or `mismatch`. Consent-off public projections omit both fields, like the other withheld verification details. `verification.checkedAt` is the time of the latest check; it is distinct from the record's `createdAt` and from `verification.createdAt`, which is the on-chain transaction's creation time. Consent-off projections retain `checkedAt` but still withhold the destination, ledger, explorer link, and memo.
Every record in list, single-record, create, edit, verify and void responses includes `version`, a positive integer that starts at `1`. Each successful `PUT /api/records/:id` and `POST /api/records/:id/void` increases it by one; verification checks do not change it. `PUT /api/records/:id` accepts an optional `expectedVersion`: send the `version` the edit started from. A value that is not a positive integer returns `400`. If the record's current `version` differs, the edit is rejected with `409` and `{ "error": "Record changed concurrently. Refresh before editing." }`, and nothing is changed. Without `expectedVersion`, the server checks against the version it read at the start of the same request, so the edit succeeds unless another write lands during that request.

When a per-IP rate limit is exceeded, the API responds with HTTP `429`, a `Retry-After` header, and `{ "error": "Too many requests. Wait a few minutes and try again.", "code": "rate_limit_exceeded" }`.

See the route handlers in `server/auth.ts` and `server/records.ts` for exact schemas and response fields. Contract-level integration tests are in `tests/backend.test.ts`.
