UPDATE aid_records SET tx_hash = NULL WHERE BTRIM(tx_hash) = '';
UPDATE aid_records SET tx_hash = LOWER(tx_hash) WHERE tx_hash IS NOT NULL;
ALTER TABLE aid_records
  ADD CONSTRAINT aid_records_network_tx_hash_unique UNIQUE (network, tx_hash);
