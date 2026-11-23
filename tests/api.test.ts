import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, resetCursorStack, resolveApiUrl } from '../src/api.js';

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

describe('api.getPublicRecord', () => {
  it('fetches one public record by an encoded identifier', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
    const record = { id: 'record-123', network: 'testnet', status: 'verified' };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ record }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await api.getPublicRecord<typeof record>('record/123');
    expect(response.data.record).toEqual(record);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/records/record%2F123/public');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: 'include',
      cache: 'no-store',
    });
  });

  it('surfaces the public record not-found state', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: 'Record not found.' }), { status: 404 }),
        ),
    );

    await expect(api.getPublicRecord('missing-record')).rejects.toMatchObject({
      status: 404,
      message: 'GET /api/records/missing-record/public failed (404): Record not found.',
    });
  });
});

describe('api.getPage cursor pagination', () => {
  it('requests the next page with the opaque cursor unchanged', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            records: [{ id: '1' }],
            nextCursor: 'opaque-cursor-1',
            hasMore: true,
            total: 2,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            records: [{ id: '2' }],
            nextCursor: null,
            hasMore: false,
            total: 2,
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const first = await api.getPage<{ id: string }>('/api/transparency?q=aid', 'records', {
      limit: 10,
    });
    expect(first.data.records).toEqual([{ id: '1' }]);
    expect(first.data.nextCursor).toBe('opaque-cursor-1');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('limit=10');
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('cursor=');

    const second = await api.getPage<{ id: string }>('/api/transparency?q=aid', 'records', {
      limit: 10,
      cursor: first.data.nextCursor,
    });
    expect(second.data.records).toEqual([{ id: '2' }]);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('limit=10');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('cursor=opaque-cursor-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('omits the cursor after a filter reset', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ records: [], nextCursor: null, hasMore: false, total: 0 }), {
          status: 200,
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await api.getPage('/api/transparency?q=first', 'records', {
      limit: 10,
      cursor: 'stale-cursor',
    });
    await api.getPage('/api/transparency?q=reset', 'records', { limit: 10 });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('cursor=stale-cursor');
    expect(String(fetchMock.mock.calls[1]?.[0])).not.toContain('cursor=');
    expect(resetCursorStack()).toEqual([null]);
  });

  it('rejects repeated nextCursor values', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
    const seenCursors = new Set<string>();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              records: [{ id: '1' }],
              nextCursor: 'same-cursor',
              hasMore: true,
            }),
            { status: 200 },
          ),
      ),
    );

    await api.getPage('/api/transparency', 'records', { limit: 1, seenCursors });
    await expect(
      api.getPage('/api/transparency', 'records', {
        limit: 1,
        cursor: 'same-cursor',
        seenCursors,
      }),
    ).rejects.toThrow('The API returned a repeated pagination cursor.');
  });

  it('surfaces HTTP errors from getPage', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: 'Invalid cursor.' }), { status: 400 }),
        ),
    );

    await expect(api.getPage('/api/transparency', 'records', { limit: 10 })).rejects.toMatchObject({
      status: 400,
      message: 'GET /api/transparency?limit=10 failed (400): Invalid cursor.',
    });
  });

  it('stops at end of list without issuing another request', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ records: [{ id: 'last' }], nextCursor: null, hasMore: false }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const page = await api.getPage<{ id: string }>('/api/transparency', 'records', { limit: 10 });
    expect(page.data.hasMore).toBe(false);
    expect(page.data.nextCursor).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
