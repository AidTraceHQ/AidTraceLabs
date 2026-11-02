import { describe, expect, it } from 'vitest';
import { resolvePseudonymSecret } from '../server/pseudonym.js';

describe('pseudonym secret configuration', () => {
  it('requires an explicit key in production', () => {
    expect(() => resolvePseudonymSecret({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(
      'PSEUDONYM_SECRET must contain at least 32 bytes.',
    );
  });

  it('rejects a short configured key', () => {
    expect(() =>
      resolvePseudonymSecret({
        NODE_ENV: 'production',
        PSEUDONYM_SECRET: 'too-short',
      } as NodeJS.ProcessEnv),
    ).toThrow('PSEUDONYM_SECRET must contain at least 32 bytes.');
  });

  it('uses the clearly development-only fallback only in development', () => {
    expect(resolvePseudonymSecret({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(
      'aidtrace-development-only-pseudonym-secret',
    );
  });

  it('uses the explicit production key', () => {
    const secret = 'production-pseudonym-key-with-at-least-32-bytes';
    expect(
      resolvePseudonymSecret({
        NODE_ENV: 'production',
        PSEUDONYM_SECRET: secret,
      } as NodeJS.ProcessEnv),
    ).toBe(secret);
  });
});
