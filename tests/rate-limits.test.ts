import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createSecurityRejectionAuditor, requireAllowedOrigin } from '../server/http-security.js';
import { createApiIpRateLimiter, createIpRateLimiter } from '../server/rate-limits.js';

describe('per-IP API rate limiter', () => {
  it('returns 429 with Retry-After when the configured limit is exceeded', async () => {
    const app = express();
    const rejected: { category: string; scope?: string }[] = [];
    const logRejection = (event: { category: string; scope?: string }) => rejected.push(event);
    const publicReadLimiter = createIpRateLimiter(60_000, 2, 'public_read_ip', logRejection);
    app.use('/api', createApiIpRateLimiter(60_000, 1, logRejection));
    app.get('/api/transparency', publicReadLimiter, (_request, response) =>
      response.json({ ok: true }),
    );
    app.get('/api/_healthcheck', publicReadLimiter, (_request, response) =>
      response.json({ ok: true }),
    );
    app.get('/api/test', (_request, response) => response.json({ ok: true }));

    const allowed = await request(app).get('/api/test');
    const limited = await request(app).get('/api/test');
    const publicFirst = await request(app).get('/api/transparency');
    const publicSecond = await request(app).get('/api/_healthcheck');
    const publicThird = await request(app).get('/api/transparency');

    expect(allowed.status).toBe(200);
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: 'rate_limit_exceeded' });
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(publicFirst.status).toBe(200);
    expect(publicSecond.status).toBe(200);
    expect(publicThird.status).toBe(429);
    expect(rejected).toEqual([
      { category: 'rate_limit', scope: 'api_ip' },
      { category: 'rate_limit', scope: 'public_read_ip' },
    ]);
  });
});

describe('bounded security rejection audit writes', () => {
  it('caps audit writes for repeated rejected-origin requests', async () => {
    const write = vi.fn(async () => undefined);
    const audit = createSecurityRejectionAuditor(write, 3, 60_000, () => 1_000);
    const app = express();
    app.post('/protected', (request, response) => {
      if (!requireAllowedOrigin(request, response, audit)) return;
      response.sendStatus(204);
    });

    for (let attempt = 0; attempt < 12; attempt += 1) {
      expect((await request(app).post('/protected').send({ marker: 'hostile-body' })).status).toBe(
        403,
      );
    }
    await new Promise((resolve) => setImmediate(resolve));

    expect(write).toHaveBeenCalledTimes(3);
    expect(write).toHaveBeenCalledWith({ category: 'origin_denial' });
  });

  it('caps writes per category window and records only allowlisted event fields', async () => {
    const write = vi.fn(async () => undefined);
    const audit = createSecurityRejectionAuditor(write, 3, 60_000, () => 1_000);
    for (let index = 0; index < 12; index += 1) {
      audit({ category: 'origin_denial' });
    }

    await new Promise((resolve) => setImmediate(resolve));

    expect(write).toHaveBeenCalledTimes(3);
    expect(write).toHaveBeenCalledWith({ category: 'origin_denial' });
  });

  it('does not retry or recursively audit when the database write fails', async () => {
    const write = vi.fn(async () => {
      throw new Error('database connection URL must not be logged');
    });
    const audit = createSecurityRejectionAuditor(write, 3, 60_000, () => 1_000);
    const logError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    audit({ category: 'csrf_denial' });
    await new Promise((resolve) => setImmediate(resolve));

    expect(write).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith('Security rejection audit write failed.');
    logError.mockRestore();
  });
});
