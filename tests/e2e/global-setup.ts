import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Keypair } from '@stellar/stellar-sdk';
import { Pool } from 'pg';

type E2eState = {
  organizationAddress: string;
  verifiedRecipient: string;
  mismatchRecipient: string;
  recordIds: string[];
};

export default async function globalSetup(): Promise<void> {
  const statePath = process.env.AIDTRACE_E2E_STATE_PATH;
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!statePath || !databaseUrl) {
    throw new Error('E2E fixture state path and TEST_DATABASE_URL are required.');
  }

  process.env.DATABASE_URL = databaseUrl;
  process.env.DATABASE_URL_UNPOOLED = process.env.TEST_DATABASE_URL_UNPOOLED || databaseUrl;
  const { migrate } = await import('../../scripts/migrate.js');
  await migrate();

  const organizationAddress = Keypair.random().publicKey();
  const verifiedRecipient = Keypair.random().publicKey();
  const mismatchRecipient = Keypair.random().publicKey();
  const marker = randomBytes(8).toString('hex');
  const recordIds = [randomBytes(16).toString('hex'), randomBytes(16).toString('hex')];
  const transactionHashes = [randomBytes(32).toString('hex'), randomBytes(32).toString('hex')];
  const state: E2eState = {
    organizationAddress,
    verifiedRecipient,
    mismatchRecipient,
    recordIds,
  };
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO users (wallet_address) VALUES ($1), ($2), ($3)
         ON CONFLICT (wallet_address) DO NOTHING`,
        [organizationAddress, verifiedRecipient, mismatchRecipient],
      );
      await client.query(
        `INSERT INTO organizations (wallet_address, display_name, normalized_name)
         VALUES ($1, $2, $3)`,
        [organizationAddress, 'E2E Organization ' + marker, 'e2e-' + marker],
      );
      const records = [
        {
          id: recordIds[0]!,
          recipient: 'E2E Verified ' + marker,
          recipientAddress: verifiedRecipient,
          purpose: 'Browser test verified payment',
          amountStroops: '12500000',
          status: 'verified',
          hash: transactionHashes[0]!,
        },
        {
          id: recordIds[1]!,
          recipient: 'E2E Mismatch ' + marker,
          recipientAddress: mismatchRecipient,
          purpose: 'Browser test mismatched payment',
          amountStroops: '25000000',
          status: 'mismatch',
          hash: transactionHashes[1]!,
        },
      ];

      for (const [index, record] of records.entries()) {
        await client.query(
          `INSERT INTO aid_records
             (id, organization_wallet, recipient_name, recipient_wallet, purpose, amount_stroops,
              asset_code, network, tx_hash, disbursement_date, note, recipient_consent, status, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, 'XLM', 'testnet', $7, CURRENT_DATE, '', TRUE, $8, $2)`,
          [
            record.id,
            organizationAddress,
            record.recipient,
            record.recipientAddress,
            record.purpose,
            record.amountStroops,
            record.hash,
            record.status,
          ],
        );
        await client.query(
          `INSERT INTO verification_results
             (id, aid_record_id, status, differences_json, ledger, transaction_created_at,
              source_account, destination, amount_stroops, asset_code, checked_at, cache_expires_at)
           VALUES ($1, $2, $3, $4::jsonb, $5, NOW(), $6, $7, $8, 'XLM', NOW(),
                   NOW() + INTERVAL '1 hour')`,
          [
            randomBytes(16).toString('hex'),
            record.id,
            record.status,
            JSON.stringify(index === 0 ? [] : ['Amount does not match the published record.']),
            index + 1,
            organizationAddress,
            record.recipientAddress,
            index === 0 ? '12500000' : '10000000',
          ],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    await mkdir(dirname(statePath), { recursive: true });
    await writeFile(statePath, JSON.stringify(state), { flag: 'w' });
  } finally {
    await pool.end();
  }
}
