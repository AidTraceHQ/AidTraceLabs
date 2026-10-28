import '../server/environment.js';
import { StrKey } from '@stellar/stellar-sdk';
import { pool, withTransaction } from '../server/db.js';

const address = process.env.ADMIN_WALLET;

if (!address || !StrKey.isValidEd25519PublicKey(address)) {
  throw new Error('ADMIN_WALLET must contain a Stellar public G-address.');
}

async function seed() {
  await withTransaction(async client => {
    await client.query(
      `INSERT INTO users (wallet_address)
       VALUES ($1)
       ON CONFLICT (wallet_address) DO NOTHING`,
      [address],
    );
    await client.query(
      `INSERT INTO wallet_roles (wallet_address, role, updated_by)
       VALUES ($1, 'admin', $1)
       ON CONFLICT (wallet_address)
       DO UPDATE SET role = 'admin', updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [address],
    );
  });
  console.log(`Administrator role ensured for ${address}.`);
}

seed()
  .catch(error => {
    console.error('Admin seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
