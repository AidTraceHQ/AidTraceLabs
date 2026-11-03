import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../server/app.js';
import { pool } from '../server/db.js';

describe('transient database failures on public GET routes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('retries once and responds with a sanitized 503 when the retry also fails', async () => {
    const databaseError = Object.assign(
      new Error('Connection terminated unexpectedly; do-not-leak-this'),
      { code: 'EAI_AGAIN' },
    );
    const query = vi.spyOn(pool, 'query').mockRejectedValue(databaseError);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await request(app).get('/api/transparency');

    expect(query).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: 'database_unavailable' });
    expect(JSON.stringify(response.body)).not.toContain('do-not-leak-this');
    expect(log).toHaveBeenCalledWith('Database failure GET /api/transparency (Error)');
  });
});
