-- Mirrors validateRecord in server/records.ts. scripts/migrate.ts counts rows that would
-- violate these rules before this file runs and aborts without changing any row.
-- A missing transaction hash is stored as NULL; a present hash is lowercase 64-hex.
-- Issuer addresses are checked for G-address shape only; the API also verifies the
-- StrKey checksum, which PostgreSQL cannot.
ALTER TABLE aid_records
  ADD CONSTRAINT aid_records_tx_hash_format
    CHECK (tx_hash IS NULL OR tx_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT aid_records_asset_code_format
    CHECK (asset_code ~ '^[A-Z0-9]{1,12}$'),
  ADD CONSTRAINT aid_records_native_asset_without_issuer
    CHECK (asset_code <> 'XLM' OR asset_issuer IS NULL),
  ADD CONSTRAINT aid_records_issued_asset_issuer_format
    CHECK (asset_code = 'XLM' OR (asset_issuer IS NOT NULL AND asset_issuer ~ '^G[A-Z2-7]{55}$'));
