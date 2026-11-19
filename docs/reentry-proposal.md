# Re-entry of a voided payment — design proposal

## Background

AidTrace never deletes records. Voiding sets `status = 'voided'` and records
`void_reason`, `voided_by`, and `voided_at`, but the row stays in place.
`storeVerification` deliberately keeps a voided record voided (the `CASE WHEN
voided_at IS NULL` guard in the UPDATE).

The current uniqueness rule is a plain `UNIQUE (network, tx_hash)` constraint
(`aid_records_network_tx_hash_unique`, added in
`migrations/002_unique_network_tx_hash.sql`). This means once a (network,
tx_hash) pair has been entered — even if the record is later voided — no new
record can reference the same payment. There is no supported recovery path.

---

## Options

### Option A — Add an explicit admin "reopen" action

The constraint stays as-is. A new endpoint (`POST /api/records/:id/reopen`)
clears `voided_at`, `voided_by`, `void_reason`, and resets status to
`pending` or `unverified` depending on whether a `tx_hash` is present. Only
admins (or the owning organization, subject to policy) may reopen. The
(network, tx_hash) uniqueness rule is never relaxed; re-entry through a new
record is still blocked.

### Option B — Partial unique index (non-voided rows only)

Drop `aid_records_network_tx_hash_unique` and replace it with a partial index:

```sql
CREATE UNIQUE INDEX aid_records_network_tx_hash_active_unique
  ON aid_records (network, tx_hash)
  WHERE status <> 'voided' AND tx_hash IS NOT NULL;
```

A new record may then be created for the same (network, tx_hash) as long as
every existing row for that pair is voided. The old voided row is preserved;
the new record starts life as a fresh entry and goes through the normal
verification flow.

### Option C — Reject re-entry; document a correction path

Re-entry is rejected by design. The documented recovery is an admin correcting
the voided record in place (editing its fields via the existing update
endpoint). No schema change, no new endpoint.

---

## Comparison

| | Constraint change | New endpoint | Preserves void | Audit clarity |
|---|---|---|---|---|
| A — reopen | None | Yes | Yes | Good — single record, clear timeline |
| B — partial index | Replace constraint | None | Yes | Moderate — two records for one payment |
| C — in-place correction | None | None | Yes | Weak — edits overwrite intent |

**Option C** breaks the purpose of voiding: if a record can be corrected in
place after being voided, the void carries no useful meaning. It also offers no
clean way to explain what changed, and it conflates "this entry was wrong" with
"this payment was invalid".

**Option B** permits two live rows that describe the same on-chain transaction.
Even with the voided row preserved, the public ledger now shows a payment twice
(once voided, once active), which is confusing for recipients and auditors.
Partial indexes are also less obvious to future maintainers than an explicit
constraint, and the approach gives any user with create-record permission the
ability to effectively un-void a payment without any admin gate.

**Option A** keeps the uniqueness rule strict and puts recovery behind an
explicit, auditable admin action. The original row is never modified except for
the void metadata being cleared; the entire history of void → reopen is visible
in the audit log. This is consistent with how AidTrace treats all other
sensitive state changes.

**Recommended: A**

---

## Unique-rule effect under each option

**Option A (recommended):** `aid_records_network_tx_hash_unique` stays as-is.
The constraint continues to enforce `UNIQUE (network, tx_hash)` across all
rows regardless of status. Re-entry through a new `POST /api/records` for the
same (network, tx_hash) remains blocked; the only path back is the reopen
action on the existing row.

**Option B:** `aid_records_network_tx_hash_unique` is dropped and replaced by a
partial unique index with the predicate `WHERE status <> 'voided' AND tx_hash
IS NOT NULL`. Voided rows are excluded from the uniqueness check, so a new
record can be created for the same (network, tx_hash) once all prior rows for
that pair are voided.

**Option C:** `aid_records_network_tx_hash_unique` stays as-is. No schema
change is made.

---

## Consent and privacy

`publicRecord()` (`server/records.ts:264`) redacts `recipient`, `recipientAddress`,
`txHash`, `note`, and partial verification fields when `consent` is false.

**Under Option A (reopen):**

- While voided, the row is already visible through the public/transparency
  endpoint. `publicRecord()` applies exactly as it does today — if `consent` is
  false, `txHash` and `recipientAddress` are redacted regardless of the voided
  status.
- After a reopen, the row is a live record again. The same `publicRecord()`
  projection applies. No new PII surface is introduced because it is the same
  row with the same `recipient_consent` flag.
- `recipient_consent` itself is not affected by the reopen action. If the
  organization needs to re-collect consent after a void+reopen cycle, that is a
  policy decision outside this schema change.

Under Options B and C the consent model is unchanged from today.

---

## Audit-log effects

AidTrace writes audit events via `writeAudit(client, action, summary, actor,
recordId, subject)`, which inserts into `audit_events` with fields:
`id`, `action`, `actor_wallet`, `subject_wallet`, `record_id`, `summary`.

**Option A** would write the following events:

| Event | `action` | `actor_wallet` | `subject_wallet` | `record_id` | `summary` |
|---|---|---|---|---|---|
| Void (existing) | `record_voided` | voiding wallet | — | record id | `"Voided aid record <id>."` |
| Reopen | `record_reopened` | admin/org wallet | — | record id | `"Reopened aid record <id>."` |

The reopen event maps cleanly onto the existing `writeAudit` signature — no new
fields are needed. The full timeline (created → voided → reopened) is
reconstructible from `audit_events` filtered by `record_id`.

Options B and C introduce no new audit event types beyond the existing
`record_voided` (and, for B, whatever audit event the new-record POST already
writes).

---

## Migration and rollback

**Option A** requires no migration. The `aid_records_network_tx_hash_unique`
constraint is unchanged. The reopen endpoint is application-only code, and the
only schema impact would be a future migration to add an index on `voided_at`
if performance warrants it — but that is not needed to ship the feature. No
migration file is added under this issue.

If a migration were ever needed in a follow-up (e.g. an index), it would be
added as a new numbered file (`migrations/003_...sql`) and never as an edit to
an existing migration. Rollback on the Neon/Vercel demo database would be a
plain `DROP INDEX` statement, which is safe on existing rows and can be applied
without a maintenance window.

---

## Proposed tests

The following tests would verify the implementation in a follow-up issue:

1. **Create → void → reopen, same (network, tx_hash):**
   POST a record, void it with a reason, then call the reopen endpoint on the
   same `id`. Assert the response has `voidedAt: null`, `status` back to
   `pending` or `unverified`, and no `voidReason`.

2. **Constraint still blocks a second new record:**
   After the reopen, attempt `POST /api/records` with the same (network,
   tx_hash). Assert the server returns 409. The constraint must still fire
   because the reopened row is now active.

3. **Audit events written in order:**
   After the create → void → reopen sequence, query `audit_events` for the
   record id. Assert three events in order: the creation event, `record_voided`,
   `record_reopened`. Each must carry the correct `actor_wallet` and `record_id`.

4. **Voided record visible under public projection:**
   Before reopening, GET the public ledger and confirm the voided row is present
   but that `txHash` and `recipientAddress` are empty strings when `consent` is
   false (existing `publicRecord()` behaviour, unchanged).

5. **Database-level constraint check:**
   Directly against the test database, insert two rows with the same (network,
   tx_hash) where one has `status = 'voided'`. Under Option A this must still
   raise a unique-constraint violation, confirming the constraint was not
   relaxed.

6. **Only admin or owning organization may reopen:**
   Assert that a request from an unrelated organization wallet returns 403.
