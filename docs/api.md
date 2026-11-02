# API

All API responses are configured with `Cache-Control: no-store`. Error responses use `{ "error": "..." }`. Protected writes require an allowed `Origin`, an authenticated session, and a valid CSRF token unless noted. List routes use bounded cursor pagination.

| Method and path                    | Access                                        | Purpose                                                         |
| ---------------------------------- | --------------------------------------------- | --------------------------------------------------------------- |
| `GET /api/_healthcheck`            | Public                                        | Process liveness; does not check database readiness.            |
| `POST /api/auth/challenge`         | Public, allowed Origin                        | Create a short-lived wallet challenge.                          |
| `POST /api/auth/verify`            | Public, allowed Origin                        | Verify wallet signature and set session cookie.                 |
| `GET /api/me`                      | Optional session                              | Return current session or `null`.                               |
| `POST /api/auth/logout`            | Optional session, Origin; CSRF when signed in | Revoke current session and clear cookie.                        |
| `POST /api/auth/logout-everywhere` | Authenticated, CSRF                           | Revoke every session for the wallet.                            |
| `GET /api/transparency`            | Public; optional session changes projection   | Filter and page public records and summary/facets.              |
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

Authentication challenge inputs are `{ address, network }`. Signature verification accepts `{ challengeId, address, network, signature }`. Record write fields are validated server-side; mutating request bodies include `csrfToken`.

See the route handlers in `server/auth.ts` and `server/records.ts` for exact schemas and response fields. Contract-level integration tests are in `tests/backend.test.ts`.
