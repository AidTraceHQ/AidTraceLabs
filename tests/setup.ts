import { config } from 'dotenv';

config({ path: ['.env.local', '.env'] });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl) {
  if (process.env.TEST_DATABASE_BRANCH !== 'test') {
    throw new Error('TEST_DATABASE_BRANCH must be set to "test" when TEST_DATABASE_URL is configured.');
  }
  if (!process.env.DATABASE_URL || !process.env.TEST_DATABASE_URL_UNPOOLED ||
      !process.env.PRODUCTION_DATABASE_HOST) {
    throw new Error('Runtime, test-direct, and production-host settings must be configured before running DB tests.');
  }
  const endpoint = (value: string) => new URL(value).hostname.toLowerCase().replace(/-pooler(?=\.)/, '');
  const productionHost = process.env.PRODUCTION_DATABASE_HOST.toLowerCase().replace(/-pooler(?=\.)/, '');
  if (endpoint('https://' + productionHost) !== productionHost) {
    throw new Error('PRODUCTION_DATABASE_HOST must be a hostname, not a URL.');
  }
  if (endpoint(testDatabaseUrl) === productionHost ||
      endpoint(process.env.TEST_DATABASE_URL_UNPOOLED) === productionHost) {
    throw new Error('TEST_DATABASE_URL points at the Neon production branch; refusing to run tests.');
  }
  if (endpoint(testDatabaseUrl) === endpoint(process.env.DATABASE_URL)) {
    throw new Error('TEST_DATABASE_URL points at the application DATABASE_URL endpoint; refusing to run tests.');
  }
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.DATABASE_URL_UNPOOLED = process.env.TEST_DATABASE_URL_UNPOOLED;
} else {
  process.env.DATABASE_URL = 'postgresql://localhost:1/aidtrace_test';
  process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL;
}

process.env.SESSION_SECRET = 'vitest-session-secret-with-at-least-thirty-two-bytes';
process.env.PUBLIC_APP_ORIGIN = 'http://localhost:5173';
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5173';
process.env.HORIZON_TESTNET_URL = 'https://horizon-testnet.stellar.org';
process.env.HORIZON_MAINNET_URL = 'https://horizon.stellar.org';
