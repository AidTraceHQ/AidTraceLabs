import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createIpRateLimiter } from '../server/rate-limits.js';

describe('per-IP API rate limiter', () => {
  it('returns 429 with Retry-After when the configured limit is exceeded', async () => {
    const app = express();
    app.use('/api', createIpRateLimiter(60_000, 1));
    app.get('/api/test', (_request, response) => response.json({ ok: true }));

    const allowed = await request(app).get('/api/test');
    const limited = await request(app).get('/api/test');

    expect(allowed.status).toBe(200);
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: 'rate_limit_exceeded' });
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });
});
