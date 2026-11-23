import './environment.js';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required.');
}

// Vercel Functions run on Fluid compute: many short-lived instances share the same database, so
// each instance keeps a small pool and releases idle clients quickly instead of holding them open.
const serverless = Boolean(process.env.VERCEL);

// statement_timeout and query_timeout bound individual statements, but not a client that ran BEGIN
// and then stalled between statements. PostgreSQL ends such a session after this much idle time
// inside a transaction, releasing its row locks; the next statement on that client fails instead
// of hanging. Only time spent idle inside an open transaction counts, not statement run time.
export const IDLE_IN_TRANSACTION_TIMEOUT_MS = 30_000;

export const pool = new Pool({
  connectionString,
  max: serverless ? 3 : 10,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: serverless ? 5_000 : 30_000,
  allowExitOnIdle: serverless,
  query_timeout: 20_000,
  statement_timeout: 15_000,
  idle_in_transaction_session_timeout: IDLE_IN_TRANSACTION_TIMEOUT_MS,
});

export function query<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<QueryResult<Row>> {
  return pool.query<Row>(text, values);
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let broken: Error | undefined;
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // The server may already have ended the session (for example after
      // idle_in_transaction_session_timeout). Keep the original error and discard the client
      // instead of returning a dead connection to the pool.
      broken = rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError));
    }
    throw error;
  } finally {
    client.release(broken);
  }
}
