import { afterEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../server/db.js';

describe('pool idle-client error handler', () => {
  afterEach(() => vi.restoreAllMocks());

  it('has at least one error listener registered', () => {
    expect(pool.listenerCount('error')).toBeGreaterThanOrEqual(1);
  });

  it('calls the handler exactly once and does not throw when an idle client error is emitted', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => pool.emit('error', new Error('idle client dropped'))).not.toThrow();

    expect(log).toHaveBeenCalledTimes(1);
  });

  it('does not log any fragment of DATABASE_URL in the error output', () => {
    const url = new URL(process.env.DATABASE_URL!);
    const secrets = [url.hostname, url.pathname.slice(1), url.username, url.password].filter(
      Boolean,
    );

    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    pool.emit('error', new Error('idle client dropped'));

    const logged = log.mock.calls.flat().join(' ');
    for (const secret of secrets) {
      expect(logged).not.toContain(secret);
    }
  });
});
