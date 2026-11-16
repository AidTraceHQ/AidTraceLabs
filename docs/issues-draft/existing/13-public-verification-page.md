# Public Verification Page

**Complexity:** high

## Context

The public ledger is list-only. `transparencyHandler` in `server/records.ts:692` serves
`GET /api/transparency` (`server/records.ts:762`) and applies a consent-aware projection
via `publicRecord()` (`server/records.ts:264`): when `recipient_consent` is false it
withholds `recipient`, `recipientAddress`, `txHash`, `note` and the verification
destination/link/ledger. There is no public route for a single record — the full route
list is `/api/transparency`, `/api/beneficiary` (`server/records.ts:766`), `POST
/api/records` (`server/records.ts:789`), `POST /api/records/:id/verify`
(`server/records.ts:870`), `PUT /api/records/:id` (`server/records.ts:916`), `POST
/api/records/:id/void` (`server/records.ts:1029`), `/api/admin/*` (`server/records.ts:1082`)
and `/api/audit` (`server/records.ts:1228`), plus the single-record read helper
`getRecord()` (`server/records.ts:605`) which is only used by authenticated flows.

Affected users: organizations and reviewers who want to share one record for inspection
without granting access to the administrative views. Current behavior: the reviewer must
load the whole ledger and filter it client-side. Expected behavior: a shareable, read-only
record page keyed by a non-secret identifier that applies the same public projection and
reveals nothing private.

## Acceptance criteria

- A public, read-only endpoint returns one record for a non-secret identifier and requires
  no session (for example `GET /api/records/:id/public`).
- The response is built with `publicRecord()` semantics (`server/records.ts:264`): with
  `recipient_consent` false, `recipient`, `recipientAddress`, `txHash`, `note` and the
  verification `destination`, `link` and `ledger` are withheld exactly as on the ledger.
- An unknown or malformed identifier returns 404 or 400 without echoing any other record's
  fields.
- The UI renders a shareable record page (reachable by URL, no sign-in) that shows network,
  verification outcome, the checked fields, and a plain-language statement of what
  verification does not prove.
- No session token, wallet secret or withheld identifier appears in the response body or
  the rendered page; `GET` with the session cookie present returns the same public shape.
- `npm run check` passes.

## Files to touch

- `server/records.ts`
- `src/api.ts`
- `src/App.tsx`
- `src/fullstack.css`
- `tests/backend.test.ts`
- `tests/api.test.ts`

## Test expectations

- Backend (`tests/backend.test.ts`): consent-on vs consent-off (assert the withheld fields
  are absent for consent-off), missing/malformed id, and verified / mismatch / voided
  states all return the public shape without a session.
- API (`tests/api.test.ts`): the client helper fetches a single record and surfaces the
  not-found state.
- Manual: open the page in a private window with no session and confirm the network
  response omits the withheld fields.
- Run: `npm run check`.

## Out of scope

Changing the transparency listing or its filters, QR codes, or exposing any private record
field. Not a change to authentication or the consent model.

## Depends on

None
