import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, resolveApiUrl } from '../src/api.js';

afterEach(() => vi.unstubAllGlobals());

describe('API URL configuration', () => {
  it('uses a same-origin relative API path when no base URL is configured', () => {
    expect(resolveApiUrl('/api/transparency?limit=1', '', 'http://localhost:5173')).toBe(
      '/api/transparency?limit=1',
    );
  });

  it('uses the configured API origin when one is provided', () => {
    expect(
      resolveApiUrl('/api/transparency?limit=1', 'http://localhost:3001', 'http://localhost:5173'),
    ).toBe('http://localhost:3001/api/transparency?limit=1');
  });

  it('includes the failing method and path in HTTP errors', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: 'Route not found.' }), { status: 404 }),
        ),
    );

    await expect(api.get('/api/transparency')).rejects.toThrow(
      'GET /api/transparency failed (404): Route not found.',
    );
  });

  it('preserves the HTTP status for conflict handling', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: 'Record changed concurrently.' }), { status: 409 }),
        ),
    );

    await expect(api.put('/api/records/record-id', {})).rejects.toMatchObject({
      status: 409,
      message: 'PUT /api/records/record-id failed (409): Record changed concurrently.',
    });
  });
});
