-- Forward-only metadata: record a SHA-256 checksum with each applied migration so an
-- in-place edit to a released file fails closed on the next migration run.
ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT;
