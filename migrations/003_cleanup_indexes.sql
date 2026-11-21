-- Add partial indexes that support the ephemeral cleanup script.
-- The cleanup deletes sessions/challenges/rate_limits that are expired or
-- already revoked/used. The existing indexes are either wallet-scoped or
-- partial in the wrong direction; these add the missing partial indexes so
-- the cleanup queries can use index scans instead of full table scans.

CREATE INDEX sessions_revoked_expiry_idx ON sessions (expires_at) WHERE revoked_at IS NOT NULL;
CREATE INDEX challenges_used_expiry_idx ON challenges (expires_at) WHERE used_at IS NOT NULL;