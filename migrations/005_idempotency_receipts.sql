-- Idempotency receipts for POST /api/records.
-- Scoped per authenticated organization wallet. A receipt is written in the same
-- transaction as the record, so a replay with the same key can always be matched
-- to the record it created.
CREATE TABLE IF NOT EXISTS idempotency_receipts (
  id BIGSERIAL PRIMARY KEY,
  organization_wallet TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  record_id TEXT NOT NULL,
  response_status INTEGER NOT NULL DEFAULT 201,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT idempotency_receipts_scope_key_unique UNIQUE (organization_wallet, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idempotency_receipts_record_id_idx
  ON idempotency_receipts (record_id);
