CREATE TABLE users (
  wallet_address TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_authenticated_at TIMESTAMPTZ
);

CREATE TABLE wallet_roles (
  wallet_address TEXT PRIMARY KEY REFERENCES users(wallet_address),
  role TEXT NOT NULL CHECK (role IN ('donor', 'organization', 'beneficiary', 'admin')),
  updated_by TEXT NOT NULL REFERENCES users(wallet_address),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX wallet_roles_role_wallet_idx ON wallet_roles (role, wallet_address);

CREATE TABLE organizations (
  wallet_address TEXT PRIMARY KEY REFERENCES users(wallet_address),
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
  session_hash TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
  network TEXT NOT NULL CHECK (network IN ('testnet', 'mainnet')),
  csrf_token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ
);
CREATE INDEX sessions_wallet_expiry_idx ON sessions (wallet_address, revoked_at, expires_at);
CREATE INDEX sessions_expiry_idx ON sessions (expires_at) WHERE revoked_at IS NULL;

CREATE TABLE challenges (
  challenge_id TEXT PRIMARY KEY,
  nonce TEXT NOT NULL UNIQUE,
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
  network TEXT NOT NULL CHECK (network IN ('testnet', 'mainnet')),
  signed_message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
CREATE INDEX challenges_wallet_expiry_idx ON challenges (wallet_address, expires_at, used_at);

CREATE TABLE aid_records (
  id TEXT PRIMARY KEY,
  organization_wallet TEXT NOT NULL REFERENCES organizations(wallet_address),
  recipient_name TEXT NOT NULL,
  recipient_wallet TEXT NOT NULL,
  purpose TEXT NOT NULL,
  amount_stroops BIGINT NOT NULL CHECK (amount_stroops > 0),
  asset_code TEXT NOT NULL,
  asset_issuer TEXT,
  network TEXT NOT NULL CHECK (network IN ('testnet', 'mainnet')),
  tx_hash TEXT,
  disbursement_date DATE NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  recipient_consent BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL CHECK (status IN ('verified', 'mismatch', 'not-found', 'unverified', 'pending', 'voided')),
  created_by TEXT NOT NULL REFERENCES users(wallet_address),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  void_reason TEXT,
  voided_by TEXT REFERENCES users(wallet_address),
  voided_at TIMESTAMPTZ,
  CHECK ((void_reason IS NULL AND voided_by IS NULL AND voided_at IS NULL)
      OR (void_reason IS NOT NULL AND voided_by IS NOT NULL AND voided_at IS NOT NULL))
);
CREATE INDEX aid_records_created_idx ON aid_records (created_at DESC, id DESC);
CREATE INDEX aid_records_organization_created_idx ON aid_records (organization_wallet, created_at DESC, id DESC);
CREATE INDEX aid_records_recipient_created_idx ON aid_records (recipient_wallet, created_at DESC, id DESC);
CREATE INDEX aid_records_network_status_date_idx ON aid_records (network, status, disbursement_date, id);

CREATE TABLE verification_results (
  id TEXT PRIMARY KEY,
  aid_record_id TEXT NOT NULL REFERENCES aid_records(id),
  status TEXT NOT NULL CHECK (status IN ('verified', 'mismatch', 'not-found', 'unverified', 'pending')),
  differences_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  reason TEXT,
  ledger BIGINT,
  transaction_created_at TIMESTAMPTZ,
  source_account TEXT,
  destination TEXT,
  amount_stroops BIGINT,
  asset_code TEXT,
  asset_issuer TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cache_expires_at TIMESTAMPTZ
);
CREATE INDEX verification_record_checked_idx ON verification_results (aid_record_id, checked_at DESC, id DESC);
CREATE INDEX verification_status_checked_idx ON verification_results (status, checked_at DESC);

CREATE TABLE rate_limits (
  key_hash TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (key_hash, window_start)
);
CREATE INDEX rate_limits_expiry_idx ON rate_limits (expires_at);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor_wallet TEXT REFERENCES users(wallet_address),
  subject_wallet TEXT REFERENCES users(wallet_address),
  record_id TEXT REFERENCES aid_records(id),
  summary TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX audit_events_created_idx ON audit_events (created_at DESC, id DESC);
CREATE INDEX audit_events_actor_created_idx ON audit_events (actor_wallet, created_at DESC, id DESC);
CREATE INDEX audit_events_record_created_idx ON audit_events (record_id, created_at DESC, id DESC);
CREATE INDEX audit_events_action_created_idx ON audit_events (action, created_at DESC, id DESC);
