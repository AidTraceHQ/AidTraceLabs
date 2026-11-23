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

## Error contract

Every error response has the JSON body `{ "error": "..." }`. Rate-limit responses additionally include `"code": "rate_limit_exceeded"`. "Retryable" means the same request may succeed later without modification; "Retry after fixing" means the request must change first.

| Status | Triggering condition | Retryable |
| ------ | -------------------- | --------- |
| `400` | Malformed JSON body, or a field or query parameter fails server-side validation (including a non-positive-integer `expectedVersion`). | Retry after fixing the request. |
| `401` | Session is missing, expired, or invalid on a route that requires authentication. | Retry after signing in again. |
| `403` | Session is valid but the role or organization does not permit the action, or a protected write has a missing or invalid CSRF token or a disallowed `Origin`. CSRF and Origin failures are reported as `403`, not `401`, and an expired session is not the same as a CSRF failure. | Retry after fixing the Origin or obtaining a fresh CSRF token; role/organization denials are not retryable. |
| `404` | The record, role assignment, or route does not exist, or is not visible to the caller. | No. |
| `409` | Record conflict: `expectedVersion` differs from the current `version`, or the write conflicts with the current record state. | Retry after refreshing the record. |
| `413` | Request body exceeds the allowed size. | Retry after reducing the body size. |
| `429` | Per-IP rate limit exceeded; the response includes a `Retry-After` header. | Yes, after the `Retry-After` interval. |
| `503` | Database is unavailable (see `databaseUnavailableResponse`). `GET /api/_healthcheck` does not report this state. | Yes, with backoff. |
| `500` | Unexpected server error. | Yes, with backoff; report if it persists. |

The cross-check for each row is the handler or test covering it: `server/app.ts` for `400`/`413`/`429`/`500` and CSRF/Origin handling, `server/records.ts` for `404`/`409` and record validation, `server/database-errors.ts` for `503`, and `tests/backend.test.ts` for the contract-level assertions.

List responses include `nextCursor` and `hasMore`. `GET /api/transparency` also includes `total`, the number of records matching the bound filters, independent of `limit` and `cursor`.

Authentication challenge inputs are `{ address, network }`. Signature verification accepts `{ challengeId, address, network, signature }`. Record write fields are validated server-side; mutating request bodies include `csrfToken`.

Record responses may include a `verification` object with the latest check's evidence. When Horizon reports a transaction memo, `verification.memo` holds its value and `verification.memoType` holds one of `text`, `id`, `hash`, or `return`; both are omitted when the transaction has no memo (`none`) or the result did not reach a transaction (`not-found`, `pending`, `unverified`). An `id` memo is a uint64 returned as a decimal string, and `hash`/`return` memos keep Horizon's base64 encoding. The memo is capture-only evidence for reconciliation and never affects whether a record is `verified` or `mismatch`. Consent-off public projections omit both fields, like the other withheld verification details.
Every record in list, single-record, create, edit, verify and void responses includes `version`, a positive integer that starts at `1`. Each successful `PUT /api/records/:id` and `POST /api/records/:id/void` increases it by one; verification checks do not change it. `PUT /api/records/:id` accepts an optional `expectedVersion`: send the `version` the edit started from. A value that is not a positive integer returns `400`. If the record's current `version` differs, the edit is rejected with `409` and `{ "error": "Record changed concurrently. Refresh before editing." }`, and nothing is changed. Without `expectedVersion`, the server checks against the version it read at the start of the same request, so the edit succeeds unless another write lands during that request.

When a per-IP rate limit is exceeded, the API responds with HTTP `429`, a `Retry-After` header, and `{ "error": "Too many requests. Wait a few minutes and try again.", "code": "rate_limit_exceeded" }`.

See the route handlers in `server/auth.ts` and `server/records.ts` for exact schemas and response fields. Contract-level integration tests are in `tests/backend.test.ts`.
