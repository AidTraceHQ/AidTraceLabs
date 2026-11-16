# Design: re-entering a payment after a record is voided

**Complexity:** medium

## Context

AidTrace never deletes a record: voiding preserves the row and its reason. The void handler
`POST /api/records/:id/void` (`server/records.ts:1029`) sets `status = 'voided'`,
`void_reason`, `voided_by` and `voided_at` (`server/records.ts:1058`), and
`storeVerification` deliberately keeps a voided record voided (`server/records.ts:673`).
Uniqueness of the payment is enforced by `aid_records_network_tx_hash_unique UNIQUE
(network, tx_hash)` (`migrations/002_unique_network_tx_hash.sql:3`).

Consequence: a record voided by mistake cannot be re-entered. A new `POST /api/records`
(`server/records.ts:789`) reusing the same `(network, tx_hash)` is rejected by the
constraint, and there is no supported way to re-enter the payment.

This issue is **design-first**: the deliverable is a written proposal, not code. No code or
migration changes under this issue. The maintainer approves the proposal and records the
chosen option before a follow-up implementation issue is opened.

Options to weigh:

- **A.** Keep the constraint strict and add an explicit admin "reopen" (un-void) action as
  the only way to re-enter a payment.
- **B.** Relax uniqueness for voided rows (a partial unique index that applies only to
  non-voided records) so a new record may be created once every existing record for that
  `(network, tx_hash)` is voided.
- **C.** Reject re-entry by design and document a supported recovery path such as
  correcting the voided record in place.

## Acceptance criteria

A proposal document is added under `docs/` (for example `docs/reentry-proposal.md`) and is
checkable by review against all of the following:

- **Comparison and recommendation.** The proposal compares options A, B and C, recommends
  exactly one (stated explicitly, for example "Recommended: B"), and gives a stated reason
  for the recommendation and for each rejected option.
- **Unique-rule effect.** It states exactly what happens to the unique `(network, tx_hash)`
  rule under the recommended option — whether `aid_records_network_tx_hash_unique` stays
  as-is, is replaced by a partial unique index (with the exact predicate), or is otherwise
  changed — and states what happens for each of the two non-recommended options.
- **Consent and privacy.** It covers the effect on the consent model (`recipient_consent`)
  and on the `publicRecord()` projection (`server/records.ts:264`), including what a public
  or consent-off view would reveal for a re-entered or reopened record.
- **Audit-log effects.** It states which audit events the recommended option would write
  (void, reopen, re-entry, correction) and how they map onto the existing `writeAudit`
  behaviour (`server/records.ts:290`), enumerating the fields each event would record.
- **Migration and rollback (demo database).** For the recommended option it describes the
  migration as a **new** file under `migrations/` (never an edit to an existing migration)
  and an explicit rollback for the Neon/Vercel demo database, including whether the change
  is safe on existing rows. It states clearly if the recommended option needs no migration.
- **Proposed tests.** It lists the concrete tests that would prove the recommended option:
  create → void → re-enter/reopen for the same `(network, tx_hash)`; audit events written;
  voided records stay visible under the existing public projection; and the constraint
  behaviour at the database level.
- **No code or migration change.** This issue changes only files under `docs/`; it does not
  modify application code, `migrations/`, or the database.
- `npm run check` passes (docs-only change).

## Files to touch

- `docs/reentry-proposal.md` (or another single file under `docs/`)
- `docs/architecture.md` or `docs/security.md` (link to the proposal, only if the maintainer
  wants it referenced there)

## Test expectations

- No automated code tests are added; this is a documentation deliverable.
- Review check: the proposal contains all six required elements above and recommends exactly
  one option.
- Run: `npm run check` (must stay green; docs-only change).

## Out of scope

Any code, migration or database change — including adding a reopen endpoint, changing the
unique constraint, or editing `migrations/`. Implementing the recommended option belongs in
a follow-up issue that depends on the approved proposal. Changing the void audit trail or
deleting any record.

## Depends on

The maintainer approving the proposal and recording the chosen option (A, B or C).
