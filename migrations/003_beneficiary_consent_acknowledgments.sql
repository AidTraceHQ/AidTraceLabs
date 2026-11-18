CREATE TABLE beneficiary_consent_challenges (
  challenge_id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES aid_records(id),
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
  network TEXT NOT NULL CHECK (network IN ('testnet', 'mainnet')),
  action TEXT NOT NULL CHECK (action IN ('acknowledge', 'revoke')),
  nonce TEXT NOT NULL,
  statement_version TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX beneficiary_consent_challenges_expiry_idx
  ON beneficiary_consent_challenges (expires_at);

CREATE TABLE beneficiary_consent_acknowledgments (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES aid_records(id),
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
  statement_version TEXT NOT NULL,
  message_hash TEXT NOT NULL,
  signature_hash TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revocation_message_hash TEXT,
  revocation_signature_hash TEXT
);
CREATE INDEX beneficiary_consent_acknowledgments_active_idx
  ON beneficiary_consent_acknowledgments (record_id, expires_at DESC)
  WHERE revoked_at IS NULL;
