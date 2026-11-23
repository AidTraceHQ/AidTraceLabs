CREATE INDEX wallet_roles_updated_wallet_idx
  ON wallet_roles (updated_at DESC, wallet_address DESC);
