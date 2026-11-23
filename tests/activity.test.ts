import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACTIVITY_TIMEOUT_MESSAGE,
  MAX_CONCURRENT_ACTIVITY_REQUESTS,
  createActivityCoordinator,
  fetchActivity,
  type ActivityPublishedRecord,
} from '../src/activity.js';

const address = 'G' + 'A'.repeat(55);
const endpoints = {
  testnet: 'https://horizon-testnet.example',
  mainnet: 'https://horizon.example',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Horizon activity loading', () => {
  it('loads the account balance, payments, and transactions with bounded responses', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === '/accounts/' + address) {
        return new Response(
          JSON.stringify({ balances: [{ asset_type: 'native', balance: '12.5000000' }] }),
          { status: 200 },
        );
      }
      if (url.pathname.endsWith('/payments')) {
        return new Response(
          JSON.stringify({
            _embedded: {
              records: [
                {
                  id: 'payment-1',
                  transaction_hash: 'hash-1',
                  from: address,
                  to: 'GBENEFICIARY',
                  amount: '2.5',
                  asset_type: 'native',
                  created_at: '2026-01-15T10:00:00Z',
                },
              ],
            },
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          _embedded: {
            records: [
              {
                id: 'tx-1',
                hash: 'hash-1',
                source_account: address,
                successful: true,
                created_at: '2026-01-15T10:00:00Z',
              },
              {
                id: 'tx-2',
                hash: 'hash-2',
                source_account: address,
                successful: false,
                created_at: '2026-01-14T10:00:00Z',
              },
            ],
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const published: (ActivityPublishedRecord & { id: string })[] = [
      { id: 'record-1', network: 'testnet', txHash: 'hash-1' },
    ];
    const snapshot = await fetchActivity({
      address,
      network: 'testnet',
      publishedRecords: published,
      endpoints,
    });

    expect(snapshot.balance).toBe('12.5000000');
    expect(snapshot.items).toHaveLength(2);
    expect(snapshot.items[0]).toMatchObject({
      id: 'payment-1',
      type: 'sent',
      hash: 'hash-1',
      publishedRecord: { id: 'record-1' },
    });
    expect(snapshot.items.find((item) => item.hash === 'hash-2')).toMatchObject({
      type: 'transaction',
      status: 'Failed',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('reports a missing account and an unavailable Horizon', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 404 })),
    );
    await expect(
      fetchActivity({ address, network: 'testnet', publishedRecords: [], endpoints }),
    ).rejects.toThrow('Wallet account not found on testnet.');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 503 })),
    );
    await expect(
      fetchActivity({ address, network: 'mainnet', publishedRecords: [], endpoints }),
    ).rejects.toThrow('Horizon is unavailable.');
  });
});

describe('activity request lifecycle', () => {
  it('ignores a stale result after logout', async () => {
    const pending = deferred<string>();
    const results: string[] = [];
    let settled = 0;
    const coordinator = createActivityCoordinator<string>({ load: () => pending.promise });

    coordinator.request(
      { address, network: 'testnet' },
      { onResult: (value) => results.push(value), onSettled: () => (settled += 1) },
    );
    coordinator.invalidate();
    pending.resolve('stale-wallet-result');
    await vi.waitFor(() => expect(coordinator.activeCount()).toBe(0));

    expect(results).toEqual([]);
    expect(settled).toBe(0);
  });

  it('ignores the previous wallet or network result after a switch', async () => {
    const testnet = deferred<string>();
    const mainnet = deferred<string>();
    const results: string[] = [];
    const coordinator = createActivityCoordinator<string>({
      load: ({ network }) => (network === 'testnet' ? testnet.promise : mainnet.promise),
    });

    coordinator.request(
      { address, network: 'testnet' },
      { onResult: (value) => results.push(value) },
    );
    coordinator.request(
      { address: 'G' + 'B'.repeat(55), network: 'mainnet' },
      { onResult: (value) => results.push(value) },
    );

    testnet.resolve('testnet-result');
    await vi.waitFor(() => expect(coordinator.queuedCount()).toBe(1));
    mainnet.resolve('mainnet-result');
    await vi.waitFor(() => expect(results).toEqual(['mainnet-result']));

    expect(coordinator.activeCount()).toBe(0);
  });

  it('times out a slow request, settles loading, and shows a recoverable error', async () => {
    vi.useFakeTimers();
    const errors: Error[] = [];
    let settled = 0;
    const coordinator = createActivityCoordinator<string>({
      load: () => new Promise<string>(() => undefined),
      timeoutMs: 50,
    });

    coordinator.request(
      { address, network: 'testnet' },
      { onError: (error) => errors.push(error), onSettled: () => (settled += 1) },
    );
    await vi.advanceTimersByTimeAsync(50);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toBe(ACTIVITY_TIMEOUT_MESSAGE);
    expect(errors[0]?.message).toMatch(/retry/i);
    expect(settled).toBe(1);
    expect(coordinator.activeCount()).toBe(0);
  });

  it('keeps concurrent activity requests at the fixed bound during rapid events', async () => {
    let active = 0;
    let maxActive = 0;
    const results: number[] = [];
    const coordinator = createActivityCoordinator<number>({
      load: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
        return active;
      },
    });

    for (let index = 0; index < 25; index += 1) {
      coordinator.request(
        { address: address + index, network: 'testnet' },
        { onResult: (value) => results.push(value) },
      );
    }

    await vi.waitFor(() => expect(coordinator.activeCount()).toBe(0));
    expect(maxActive).toBeLessThanOrEqual(MAX_CONCURRENT_ACTIVITY_REQUESTS);
    expect(results).toHaveLength(1);
  });
});
