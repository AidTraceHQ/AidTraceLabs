import { describe, expect, it } from 'vitest';
import { validateEnvironment } from '../server/environment.js';

describe('runtime environment validation', () => {
  it('reports the missing keys without exposing secret values', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'development',
        PORT: '3001',
      } as NodeJS.ProcessEnv),
    ).toThrow('Missing required environment variables: DATABASE_URL, SESSION_SECRET, PUBLIC_APP_ORIGIN, CORS_ALLOWED_ORIGINS, DEFAULT_STELLAR_NETWORK, HORIZON_TESTNET_URL, HORIZON_MAINNET_URL.');
  });

  it('accepts the development fallback for the pseudonym secret', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'development',
        PORT: '3001',
        DATABASE_URL: 'postgresql://localhost:5432/aidtrace',
        SESSION_SECRET: 'development-session-secret-with-at-least-thirty-two-bytes',
        PUBLIC_APP_ORIGIN: 'http://localhost:5173',
        CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
        DEFAULT_STELLAR_NETWORK: 'testnet',
        HORIZON_TESTNET_URL: 'https://horizon-testnet.stellar.org',
        HORIZON_MAINNET_URL: 'https://horizon.stellar.org',
      } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });

});
