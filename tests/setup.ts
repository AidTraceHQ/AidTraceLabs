process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ||
  'postgresql://test:test@127.0.0.1:1/aidtrace_test';
process.env.SESSION_SECRET = 'vitest-session-secret-with-at-least-thirty-two-bytes';
process.env.PUBLIC_APP_ORIGIN = 'http://localhost:5173';
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5173';
process.env.HORIZON_TESTNET_URL = 'https://horizon-testnet.stellar.org';
process.env.HORIZON_MAINNET_URL = 'https://horizon.stellar.org';
