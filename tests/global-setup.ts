import { setTimeout } from 'node:timers/promises';
import { config } from 'dotenv';
import { Client } from 'pg';

config({ path: ['.env.local', '.env'] });

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : undefined;
}

export default async function globalSetup(): Promise<void> {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) return;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const client = new Client({
      connectionString,
      connectionTimeoutMillis: 10_000,
      query_timeout: 15_000,
    });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return;
    } catch (error) {
      const code = errorCode(error);
      try {
        await client.end();
      } catch {
        // The client may not have connected.
      }
      if (!['EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT'].includes(code || '') || attempt === 2) {
        // Keep the failure report limited to its code; the driver error may contain a hostname.
        throw new Error(`Test database warm-up failed (${code || 'unknown error'}).`, {
          cause: code || 'unknown error', // eslint-disable-line preserve-caught-error
        });
      }
      await setTimeout(1000);
    }
  }
}
