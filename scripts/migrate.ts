import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, withTransaction } from '../server/db.js';

const migrationDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = (await readdir(migrationDirectory))
    .filter(file => /^\d{3}_[a-z0-9_]+\.sql$/.test(file))
    .sort();

  for (const file of files) {
    const version = file.slice(0, file.length - '.sql'.length);
    const alreadyApplied = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE version = $1',
      [version],
    );
    if (alreadyApplied.rowCount) continue;

    if (version === '002_unique_network_tx_hash') {
      const duplicates = await pool.query<{
        id: string;
        network: string;
        tx_hash: string;
        duplicate_count: string;
      }>(`
        SELECT id, network, tx_hash, duplicate_count
        FROM (
          SELECT id, network, tx_hash,
                 COUNT(*) OVER (PARTITION BY network, LOWER(tx_hash)) AS duplicate_count
          FROM aid_records
          WHERE tx_hash IS NOT NULL AND BTRIM(tx_hash) <> ''
        ) duplicate_records
        WHERE duplicate_count > 1
        ORDER BY network, LOWER(tx_hash), id
      `);
      if (duplicates.rowCount) {
        console.error('Migration 002 aborted: duplicate network/transaction hashes require resolution:');
        console.error(JSON.stringify(duplicates.rows, null, 2));
        throw new Error('Resolve the reported duplicate aid records before applying the unique-hash migration.');
      }
    }

    const sql = await readFile(join(migrationDirectory, file), 'utf8');
    await withTransaction(async client => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
    });
    console.log(`Applied migration ${version}.`);
  }
}

run()
  .catch(error => {
    console.error('Database migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
