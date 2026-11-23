-- Opt-in outbound webhook notifications (issue #10). See docs/security.md for the delivery model.
-- Target URLs and signing secrets are stored only as AES-256-GCM ciphertexts.
CREATE TABLE IF NOT EXISTS notification_endpoints (
  id TEXT PRIMARY KEY,
  owner_wallet TEXT NOT NULL REFERENCES users(wallet_address),
  scope TEXT NOT NULL CHECK (scope IN ('organization', 'all')),
  url_ciphertext TEXT NOT NULL,
  display_host TEXT NOT NULL,
  secret_ciphertext TEXT NOT NULL,
  event_types TEXT[] NOT NULL CHECK (cardinality(event_types) > 0),
  status TEXT NOT NULL CHECK (status IN ('pending_verification', 'active', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT REFERENCES users(wallet_address),
  CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS notification_endpoints_owner_idx
  ON notification_endpoints (owner_wallet, status);
CREATE INDEX IF NOT EXISTS notification_endpoints_active_idx
  ON notification_endpoints (scope, owner_wallet) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL REFERENCES notification_endpoints(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  record_id TEXT REFERENCES aid_records(id) ON DELETE CASCADE,
  payload_json JSONB NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('pending', 'delivering', 'delivered', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL CHECK (max_attempts BETWEEN 1 AND 10),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claim_token TEXT,
  lease_expires_at TIMESTAMPTZ,
  last_error TEXT,
  last_status_code INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT REFERENCES users(wallet_address) ON DELETE SET NULL,
  UNIQUE (endpoint_id, event_id)
);
CREATE INDEX IF NOT EXISTS notification_deliveries_due_idx
  ON notification_deliveries (next_attempt_at, id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS notification_deliveries_lease_idx
  ON notification_deliveries (lease_expires_at) WHERE status = 'delivering';
CREATE INDEX IF NOT EXISTS notification_deliveries_endpoint_idx
  ON notification_deliveries (endpoint_id, created_at DESC, id DESC);
