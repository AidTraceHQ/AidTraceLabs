import { config as loadDotenv } from 'dotenv';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

loadDotenv({ path: ['.env.local', '.env'] });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDatabaseUrlUnpooled = process.env.TEST_DATABASE_URL_UNPOOLED;
const runtimeDatabaseUrl = process.env.DATABASE_URL;
const productionDatabaseHost = process.env.PRODUCTION_DATABASE_HOST;

if (
  !testDatabaseUrl ||
  !testDatabaseUrlUnpooled ||
  !runtimeDatabaseUrl ||
  !productionDatabaseHost
) {
  throw new Error(
    'E2E tests require distinct DATABASE_URL, TEST_DATABASE_URL, TEST_DATABASE_URL_UNPOOLED, and PRODUCTION_DATABASE_HOST settings.',
  );
}
if (process.env.TEST_DATABASE_BRANCH !== 'test') {
  throw new Error('E2E tests require TEST_DATABASE_BRANCH to be set to "test".');
}

const databaseHost = (value: string) =>
  new URL(value).hostname.toLowerCase().replace(/-pooler(?=\.)/, '');
const sameDatabase = (left: string, right: string) => {
  const leftUrl = new URL(left);
  const rightUrl = new URL(right);
  return (
    databaseHost(left) === databaseHost(right) &&
    leftUrl.pathname.replace(/\/+$/, '') === rightUrl.pathname.replace(/\/+$/, '')
  );
};
const normalizedProductionHost = productionDatabaseHost.toLowerCase().replace(/-pooler(?=\.)/, '');
if (new URL('https://' + normalizedProductionHost).hostname !== normalizedProductionHost) {
  throw new Error('PRODUCTION_DATABASE_HOST must be a hostname, not a URL.');
}

if (
  sameDatabase(testDatabaseUrl, runtimeDatabaseUrl) ||
  sameDatabase(testDatabaseUrlUnpooled, runtimeDatabaseUrl) ||
  databaseHost(testDatabaseUrl) === normalizedProductionHost ||
  databaseHost(testDatabaseUrlUnpooled) === normalizedProductionHost
) {
  throw new Error('E2E tests refuse the runtime or production database endpoint.');
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.DATABASE_URL_UNPOOLED = testDatabaseUrlUnpooled;
process.env.NODE_ENV = 'development';
process.env.SESSION_SECRET = 'aidtrace-e2e-session-secret-placeholder-with-32-bytes';
process.env.PSEUDONYM_SECRET = 'aidtrace-e2e-pseudonym-secret-placeholder-with-32-bytes';
process.env.PUBLIC_APP_ORIGIN = 'http://localhost:5173';
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5173';
process.env.DEFAULT_STELLAR_NETWORK = 'testnet';
process.env.HORIZON_TESTNET_URL = 'http://127.0.0.1:4174/';
process.env.HORIZON_MAINNET_URL = 'http://127.0.0.1:4174/';
process.env.AIDTRACE_E2E_STATE_PATH ??= join(
  tmpdir(),
  `aidtrace-e2e-${process.pid}-${Date.now()}.json`,
);

const serverEnvironment = {
  NODE_ENV: 'development',
  DATABASE_URL: testDatabaseUrl,
  DATABASE_URL_UNPOOLED: testDatabaseUrlUnpooled,
  SESSION_SECRET: process.env.SESSION_SECRET,
  PSEUDONYM_SECRET: process.env.PSEUDONYM_SECRET,
  PUBLIC_APP_ORIGIN: 'http://localhost:5173',
  CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
  DEFAULT_STELLAR_NETWORK: 'testnet',
  HORIZON_TESTNET_URL: 'http://127.0.0.1:4174/',
  HORIZON_MAINNET_URL: 'http://127.0.0.1:4174/',
  PORT: '3001',
};

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results/playwright',
  use: {
    baseURL: 'http://localhost:5173',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev:server',
      url: 'http://127.0.0.1:3001/api/_healthcheck',
      env: serverEnvironment,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'tsx tests/e2e/horizon.ts',
      url: 'http://127.0.0.1:4174/health',
      env: { PORT: '4174' },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'npm run dev:web -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      env: { API_PROXY_TARGET: 'http://127.0.0.1:3001' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
