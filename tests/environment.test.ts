import { describe, expect, it } from 'vitest';
import { validateEnvironment } from '../server/environment.js';

describe('runtime environment validation', () => {
  it('reports the missing keys without exposing secret values', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'development',
        PORT: '3001',
      } as NodeJS.ProcessEnv),
    ).toThrow(
      'Missing required environment variables: DATABASE_URL, SESSION_SECRET, PUBLIC_APP_ORIGIN, CORS_ALLOWED_ORIGINS, DEFAULT_STELLAR_NETWORK, HORIZON_TESTNET_URL, HORIZON_MAINNET_URL.',
    );
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
  const baseEnvironment = {
    NODE_ENV: 'development',
    PORT: '3001',
    DATABASE_URL: 'postgresql://localhost:5432/aidtrace',
    PUBLIC_APP_ORIGIN: 'http://localhost:5173',
    CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
    DEFAULT_STELLAR_NETWORK: 'testnet',
    HORIZON_TESTNET_URL: 'https://horizon-testnet.stellar.org',
    HORIZON_MAINNET_URL: 'https://horizon.stellar.org',
  };

  it('rejects identical SESSION_SECRET and PSEUDONYM_SECRET without printing the value', () => {
    const sharedSecret = 'shared-secret-value-with-at-least-thirty-two-bytes';
    let message = '';
    try {
      validateEnvironment({
        ...baseEnvironment,
        SESSION_SECRET: sharedSecret,
        PSEUDONYM_SECRET: sharedSecret,
      } as NodeJS.ProcessEnv);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('SESSION_SECRET');
    expect(message).toContain('PSEUDONYM_SECRET');
    expect(message).not.toContain(sharedSecret);
  });

  it('accepts distinct secrets of at least 32 bytes', () => {
    expect(() =>
      validateEnvironment({
        ...baseEnvironment,
        SESSION_SECRET: 'session-secret-value-with-at-least-thirty-two-bytes',
        PSEUDONYM_SECRET: 'pseudonym-secret-value-with-at-least-thirty-two-bytes',
      } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });

  it('rejects a placeholder SESSION_SECRET without printing the value', () => {
    const placeholderSecret = 'replace-with-at-least-32-random-bytes';
    let message = '';
    try {
      validateEnvironment({
        ...baseEnvironment,
        SESSION_SECRET: placeholderSecret,
      } as NodeJS.ProcessEnv);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('SESSION_SECRET');
    expect(message).not.toContain(placeholderSecret);
  });

  it('accepts a non-placeholder SESSION_SECRET of at least 32 bytes', () => {
    expect(() =>
      validateEnvironment({
        ...baseEnvironment,
        SESSION_SECRET: 'random-session-secret-with-at-least-thirty-two-bytes',
      } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });
});
