import '../server/environment.js';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Pool, type PoolConfig } from 'pg';

type CleanupClient = {
  query(text: string, values?: unknown[]): Promise<{ rowCount: number | null }>;
  release(): void;
};
type CleanupPool = {
  connect(): Promise<CleanupClient>;
  end(): Promise<void>;
};

const connectionTimeoutMs = 10_000;
const defaultBatchSize = 1000;

export async function cleanupEphemeralRows(
  databaseUrl: string,
  batchSize: number = defaultBatchSize,
  createPool: (config: PoolConfig) => CleanupPool = (config) => new Pool(config),
): Promise<{ sessions: number; challenges: number; rateLimits: number }> {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 10_000) {
    throw new Error('Batch size must be an integer between 1 and 10000.');
  }

  const pool = createPool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: connectionTimeoutMs,
    query_timeout: connectionTimeoutMs,
    statement_timeout: connectionTimeoutMs,
  });

  try {
    const client = await pool.connect();
    try {
      const sessions = await cleanupTable(client, 'sessions', 'expires_at < NOW() OR revoked_at IS NOT NULL', batchSize);
      const challenges = await cleanupTable(client, 'challenges', 'expires_at < NOW() OR used_at IS NOT NULL', batchSize);
      const rateLimits = await cleanupTable(client, 'rate_limits', 'expires_at < NOW()', batchSize);
      return { sessions, challenges, rateLimits };
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

async function cleanupTable(
  client: CleanupClient,
  table: string,
  condition: string,
  batchSize: number,
): Promise<number> {
  let total = 0;
  // Use a CTE to delete in bounded batches, looping until no more rows match.
  // ctid is the physical row identifier; it works for any table structure.
  for (;;) {
    const result = await client.query(
      `WITH to_delete AS (
         SELECT ctid FROM ${table}
         WHERE ${condition}
         LIMIT $1
       )
       DELETE FROM ${table}
       WHERE ctid IN (SELECT ctid FROM to_delete)`,
      [batchSize],
    );
    const count = result.rowCount ?? 0;
    total += count;
    if (count < batchSize) break;
  }
  return total;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const batchSize = Number.parseInt(process.env.CLEANUP_BATCH_SIZE || String(defaultBatchSize), 10);
  try {
    const counts = await cleanupEphemeralRows(databaseUrl!, batchSize);
    console.log(
      `sessions=${counts.sessions} challenges=${counts.challenges} rate_limits=${counts.rateLimits}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    let safeMessage = message;
    if (databaseUrl) {
      safeMessage = safeMessage.replaceAll(databaseUrl, '[redacted DATABASE_URL]');
    }
    console.error(safeMessage);
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main();
}