import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApiIpRateLimiter, createIpRateLimiter } from '../server/rate-limits.js';

describe('per-IP API rate limiter', () => {
  it('returns 429 with Retry-After when the configured limit is exceeded', async () => {
    const app = express();
    const publicReadLimiter = createIpRateLimiter(60_000, 2);
    app.use('/api', createApiIpRateLimiter(60_000, 1));
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
  });
});
