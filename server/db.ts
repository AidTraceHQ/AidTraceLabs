import './environment.js';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required.');
}

// Vercel Functions run on Fluid compute: many short-lived instances share the same database, so
// each instance keeps a small pool and releases idle clients quickly instead of holding them open.
const serverless = Boolean(process.env.VERCEL);

export const pool = new Pool({
  connectionString,
  max: serverless ? 3 : 10,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: serverless ? 5_000 : 30_000,
  allowExitOnIdle: serverless,
  query_timeout: 20_000,
  statement_timeout: 15_000,
});

export function query<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<QueryResult<Row>> {
  return pool.query<Row>(text, values);
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
