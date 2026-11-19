CREATE TABLE reverification_claims (
  record_id TEXT PRIMARY KEY REFERENCES aid_records(id) ON DELETE CASCADE,
  claim_token TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX reverification_claims_expiry_idx ON reverification_claims (expires_at);
