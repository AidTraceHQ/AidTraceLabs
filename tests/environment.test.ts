import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateEnvironment } from '../server/environment.js';
import {
  DEFAULT_HORIZON_ENDPOINTS,
  HORIZON_ENDPOINT_ENV,
  activityRequestUrls,
  resolveHorizonEndpoints,
} from '../src/horizon.js';

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

describe('browser Horizon endpoint configuration', () => {
  const address = 'G' + 'A'.repeat(55);

  it('uses the public Stellar endpoints when no VITE_* value is configured', () => {
    const endpoints = resolveHorizonEndpoints({});

    expect(endpoints).toEqual(DEFAULT_HORIZON_ENDPOINTS);
    const urls = activityRequestUrls(endpoints.testnet, address);
    expect(urls.account).toBe(
      'https://horizon-testnet.stellar.org/accounts/' + encodeURIComponent(address),
    );
    expect(urls.payments).toContain('https://horizon-testnet.stellar.org/accounts/');
    expect(urls.transactions).toContain('/transactions?order=desc&limit=50&include_failed=true');
    expect(urls.stream).toContain('/payments?cursor=now');
  });

  it('uses a configured endpoint for account, payment, transaction, and event-stream requests', () => {
    const endpoints = resolveHorizonEndpoints({
      VITE_HORIZON_TESTNET_URL: 'https://horizon.staging.example/horizon',
      VITE_HORIZON_MAINNET_URL: 'https://horizon.example',
    });

    expect(endpoints.testnet).toBe('https://horizon.staging.example/horizon');
    expect(endpoints.mainnet).toBe('https://horizon.example');

    const urls = activityRequestUrls(endpoints.testnet, address);
    const base = 'https://horizon.staging.example/horizon/accounts/' + encodeURIComponent(address);
    expect(urls.account).toBe(base);
    expect(urls.payments).toBe(base + '/payments?order=desc&limit=50');
    expect(urls.transactions).toBe(base + '/transactions?order=desc&limit=50&include_failed=true');
    expect(urls.stream).toBe(base + '/payments?cursor=now');
    for (const url of Object.values(urls)) {
      expect(url.startsWith('https://horizon.staging.example/horizon/')).toBe(true);
    }
  });

  it('rejects invalid, insecure, or credential-bearing endpoints', () => {
    expect(() =>
      resolveHorizonEndpoints({ VITE_HORIZON_TESTNET_URL: 'http://horizon.example' }),
    ).toThrow('VITE_HORIZON_TESTNET_URL must use HTTPS.');
    expect(() => resolveHorizonEndpoints({ VITE_HORIZON_MAINNET_URL: 'not a url' })).toThrow(
      'VITE_HORIZON_MAINNET_URL must be an absolute HTTPS URL.',
    );
    expect(() =>
      resolveHorizonEndpoints({
        VITE_HORIZON_MAINNET_URL: 'https://user:password@horizon.example',
      }),
    ).toThrow('VITE_HORIZON_MAINNET_URL must not include credentials.');
    expect(() =>
      resolveHorizonEndpoints({ VITE_HORIZON_TESTNET_URL: 'https://horizon.example?token=secret' }),
    ).toThrow('VITE_HORIZON_TESTNET_URL must be a base URL without a query or fragment.');
  });

  it('keeps VITE_* configuration free of server-only secrets', () => {
    expect(Object.values(HORIZON_ENDPOINT_ENV).every((name) => name.startsWith('VITE_'))).toBe(
      true,
    );

    const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
    const viteLines = example
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('VITE_'));
    expect(viteLines.length).toBeGreaterThan(0);
    expect(viteLines.join('\n')).not.toMatch(
      /SESSION_SECRET|PSEUDONYM_SECRET|DATABASE_URL|PASSWORD|PRIVATE_KEY|TOKEN/i,
    );
  });
});
