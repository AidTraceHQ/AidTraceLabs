# Design: re-entering a payment after a record is voided

**Complexity:** medium

## Context

AidTrace never deletes a record: voiding preserves the row and its reason (see the README
note that voiding preserves a record and its reason rather than deleting it). The void
handler `POST /api/records/:id/void` (`server/records.ts:1029`) sets `status = 'voided'`,
`void_reason`, `voided_by` and `voided_at` (`server/records.ts:1058`), and
`storeVerification` deliberately keeps a voided record voided
(`server/records.ts:673`).

Every record also stores the Stellar transaction hash it was checked against, and
`migrations/002_unique_network_tx_hash.sql:3` adds
`aid_records_network_tx_hash_unique UNIQUE (network, tx_hash)`.

Consequence: if a record is voided by mistake, the operator cannot create a corrected
record for the same payment. A new `POST /api/records` (`server/records.ts:789`) reusing
the same `(network, tx_hash)` is rejected by the unique constraint, and there is no
supported way to re-enter the payment.

## Design question

A decision must be recorded before any implementation. At least these options should be
weighed:

- **A.** Keep the constraint strict and add an explicit admin "reopen" (un-void) action as
  the only way to re-enter a payment.
- **B.** Relax uniqueness for voided rows (for example a partial unique index that applies
  only to non-voided records) so a new record may be created once every existing record for
  that `(network, tx_hash)` is voided.
- **C.** Reject re-entry by design and document a supported recovery path such as correcting
  the voided record in place.

Whichever option is chosen must keep voided records visible and auditable and must not
delete history.

## Acceptance criteria

- The chosen option (A, B or C) is recorded in this issue and in `docs/architecture.md` or
  `docs/security.md`, together with its audit implications.
- Voided records remain retrievable and their void reason is preserved.
- Any state change (void, reopen, re-entry) writes an audit event consistent with existing
  behaviour (`writeAudit`, `server/records.ts:290`).
- If uniqueness changes, it is expressed as a **new** migration; existing migrations are not
  edited.
- `npm run check` passes and migration tests run against a disposable PostgreSQL database.

## Files to touch

- `migrations/` (new migration, only if the constraint changes)
- `server/records.ts`
- `tests/backend.test.ts`
- `docs/architecture.md` or `docs/security.md`

## Test expectations

- Cover: create, void, then attempt re-entry for the same `(network, tx_hash)`; reopening a
  voided record; audit events written; and that voided records stay visible under the
  existing public-projection rules.
- Run: `npm run check` and the migration tests against a disposable PostgreSQL database.

## Out of scope

Implementing the chosen behaviour in this issue — this issue is design-first and blocks on
the recorded decision. Changing the void audit trail or deleting any record.

## Depends on

The maintainer's recorded decision on the design question above.
