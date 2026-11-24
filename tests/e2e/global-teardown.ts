import { readFile, unlink } from 'node:fs/promises';
import { Pool } from 'pg';

type E2eState = {
  organizationAddress: string;
  verifiedRecipient: string;
  mismatchRecipient: string;
  recordIds: string[];
};

export default async function globalTeardown(): Promise<void> {
  const statePath = process.env.AIDTRACE_E2E_STATE_PATH;
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!statePath || !databaseUrl) return;

  const state = JSON.parse(await readFile(statePath, 'utf8')) as E2eState;
  const addresses = [state.organizationAddress, state.verifiedRecipient, state.mismatchRecipient];
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query('DELETE FROM audit_events WHERE record_id = ANY($1::text[])', [
      state.recordIds,
    ]);
    await pool.query('DELETE FROM verification_results WHERE aid_record_id = ANY($1::text[])', [
      state.recordIds,
    ]);
    await pool.query('DELETE FROM aid_records WHERE id = ANY($1::text[])', [state.recordIds]);
    await pool.query('DELETE FROM organizations WHERE wallet_address = $1', [
      state.organizationAddress,
    ]);
    await pool.query(
      `DELETE FROM wallet_roles
       WHERE wallet_address = ANY($1::text[]) OR updated_by = ANY($1::text[])`,
      [addresses],
    );
    await pool.query('DELETE FROM sessions WHERE wallet_address = ANY($1::text[])', [addresses]);
    await pool.query('DELETE FROM challenges WHERE wallet_address = ANY($1::text[])', [addresses]);
    await pool.query('DELETE FROM users WHERE wallet_address = ANY($1::text[])', [addresses]);
  } finally {
    await pool.end();
  }
  await unlink(statePath);
}
