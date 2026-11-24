-- Filtered record pages order by created_at DESC, id DESC. The existing
-- (network, status, disbursement_date, id) index cannot supply that order, so every page
-- sorts matched rows in memory.
CREATE INDEX IF NOT EXISTS aid_records_network_status_created_idx
  ON aid_records (network, status, created_at DESC, id DESC);
