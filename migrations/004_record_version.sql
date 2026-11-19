ALTER TABLE aid_records ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'aid_records'::regclass AND conname = 'aid_records_version_positive'
  ) THEN
    ALTER TABLE aid_records
      ADD CONSTRAINT aid_records_version_positive CHECK (version >= 1);
  END IF;
END
$$;
