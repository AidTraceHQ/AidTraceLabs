import {
  DEFAULT_HORIZON_ENDPOINTS,
  activityRequestUrls,
  type HorizonEndpoints,
  type StellarNetwork,
} from './horizon.js';

export { DEFAULT_HORIZON_ENDPOINTS, type HorizonEndpoints, type StellarNetwork };

export const ACTIVITY_REQUEST_TIMEOUT_MS = 15_000;
export const MAX_CONCURRENT_ACTIVITY_REQUESTS = 1;
export const ACTIVITY_TIMEOUT_MESSAGE =
  'Activity request timed out. Check your connection and retry.';

export type ActivityPublishedRecord = {
  network: StellarNetwork;
  txHash: string;
};

export type ActivityItem<
  TPublishedRecord extends ActivityPublishedRecord = ActivityPublishedRecord,
> = {
  id: string;
  hash: string;
  date: string;
  type: string;
  amount: string;
  asset: string;
  counterparty: string;
  status: string;
  network: StellarNetwork;
  publishedRecord?: TPublishedRecord;
};

export type ActivitySnapshot<TPublishedRecord extends ActivityPublishedRecord> = {
  balance: string;
  items: ActivityItem<TPublishedRecord>[];
};

export type ActivityRequest = {
  address: string;
  network: StellarNetwork;
};

export type ActivityHandlers<T> = {
  onResult?: (result: T) => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
};

export type ActivityCoordinator<T> = {
  request(request: ActivityRequest, handlers: ActivityHandlers<T>): void;
  invalidate(): void;
  activeCount(): number;
  queuedCount(): number;
};

export function shortAddress(value: string, left = 7, right = 5): string {
  return value && value.length > left + right + 1
    ? value.slice(0, left) + '…' + value.slice(-right)
    : value || '—';
}

type ActivityLoadOptions<TPublishedRecord extends ActivityPublishedRecord> = {
  address: string;
  network: StellarNetwork;
  publishedRecords: TPublishedRecord[];
  signal?: AbortSignal;
  endpoints?: HorizonEndpoints;
  fetchImpl?: typeof fetch;
};

export async function fetchActivity<TPublishedRecord extends ActivityPublishedRecord>({
  address,
  network,
  publishedRecords,
  signal,
  endpoints = DEFAULT_HORIZON_ENDPOINTS,
  fetchImpl = fetch,
}: ActivityLoadOptions<TPublishedRecord>): Promise<ActivitySnapshot<TPublishedRecord>> {
  const urls = activityRequestUrls(endpoints[network], address);
  const requestOptions: RequestInit = {
    headers: { Accept: 'application/json' },
    signal,
  };
  const [accountRes, paymentsRes, txRes] = await Promise.all([
    fetchImpl(urls.account, requestOptions),
    fetchImpl(urls.payments, requestOptions),
    fetchImpl(urls.transactions, requestOptions),
  ]);
  if (accountRes.status === 404) {
    throw new Error(
      'Wallet account not found on ' + network + '. Switch network or fund the Testnet account.',
    );
  }
  if (!accountRes.ok || !paymentsRes.ok || !txRes.ok) {
    throw new Error('Horizon is unavailable. Your records are safe; activity will retry.');
  }
  const account = (await accountRes.json()) as {
    balances?: { asset_type: string; balance: string }[];
  };
  const payments = (await paymentsRes.json()) as {
    _embedded?: { records?: Record<string, unknown>[] };
  };
  const txs = (await txRes.json()) as { _embedded?: { records?: Record<string, unknown>[] } };

  const published = publishedRecords.filter((r) => r.network === network && r.txHash);
  const payItems: ActivityItem<TPublishedRecord>[] = (payments._embedded?.records || []).map(
    (p, i) => {
      const hash = String(p.transaction_hash || '');
      const source = String(p.from || p.source_account || '');
      const dest = String(p.to || '');
      const sent = source === address;
      const code = p.asset_type === 'native' ? 'XLM' : String(p.asset_code || 'Unknown');
      return {
        id: String(p.id || hash + i),
        hash,
        date: String(p.created_at || ''),
        type: sent ? 'sent' : 'received',
        amount: String(p.amount || '—'),
        asset: code,
        counterparty: shortAddress(sent ? dest : source),
        status: 'Successful',
        network,
        publishedRecord: published.find((r) => r.txHash === hash),
      };
    },
  );
  const hashes = new Set(payItems.map((p) => p.hash));
  const txItems: ActivityItem<TPublishedRecord>[] = (txs._embedded?.records || [])
    .filter((t) => !hashes.has(String(t.hash || '')))
    .map((t, i) => ({
      id: String(t.id || t.hash || i),
      hash: String(t.hash || ''),
      date: String(t.created_at || ''),
      type: 'transaction',
      amount: '—',
      asset: '—',
      counterparty: shortAddress(String(t.source_account || '')),
      status: t.successful ? 'Successful' : 'Failed',
      network,
    }));

  return {
    balance: account.balances?.find((b) => b.asset_type === 'native')?.balance || '0',
    items: [...payItems, ...txItems]
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
      .slice(0, 100),
  };
}

type Job<T> = {
  request: ActivityRequest;
  handlers: ActivityHandlers<T>;
  generation: number;
};

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Activity request failed.');
}

export function createActivityCoordinator<T>(options: {
  load: (request: ActivityRequest, signal: AbortSignal) => Promise<T>;
  timeoutMs?: number;
}): ActivityCoordinator<T> {
  const timeoutMs = options.timeoutMs ?? ACTIVITY_REQUEST_TIMEOUT_MS;
  let generation = 0;
  let active = 0;
  let queued: Job<T> | null = null;
  let activeController: AbortController | null = null;

  function start(job: Job<T>): void {
    active += 1;
    const controller = new AbortController();
    activeController = controller;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      active -= 1;
      if (activeController === controller) activeController = null;
      if (job.generation === generation) job.handlers.onSettled?.();
      if (active === 0 && queued) {
        const next = queued;
        queued = null;
        start(next);
      }
    };

    const timer = setTimeout(() => {
      if (job.generation === generation) {
        job.handlers.onError?.(new Error(ACTIVITY_TIMEOUT_MESSAGE));
      }
      controller.abort();
      finish();
    }, timeoutMs);

    void (async () => {
      try {
        const result = await options.load(job.request, controller.signal);
        if (finished || job.generation !== generation) return;
        job.handlers.onResult?.(result);
      } catch (error) {
        if (finished || job.generation !== generation) return;
        if (!controller.signal.aborted) job.handlers.onError?.(toError(error));
      } finally {
        finish();
      }
    })();
  }

  return {
    request(request, handlers) {
      generation += 1;
      const job: Job<T> = { request, handlers, generation };
      if (active >= MAX_CONCURRENT_ACTIVITY_REQUESTS) {
        // Keep only the newest waiting request and abort the stale in-flight one.
        queued = job;
        activeController?.abort();
        return;
      }
      start(job);
    },
    invalidate() {
      generation += 1;
      queued = null;
      activeController?.abort();
    },
    activeCount: () => active,
    queuedCount: () => (queued ? 1 : 0),
  };
export const HORIZON_ACTIVITY_PAGE_SIZE = 50;

export type HorizonActivityRecord = {
  paging_token?: string;
  [key: string]: unknown;
};

export type HorizonActivityPage = {
  records: HorizonActivityRecord[];
  nextCursor: string | null;
};

export function parseHorizonActivityPage(
  payload: { _embedded?: { records?: HorizonActivityRecord[] } },
  pageSize = HORIZON_ACTIVITY_PAGE_SIZE,
): HorizonActivityPage {
  const records = payload._embedded?.records || [];
  if (records.length <= pageSize) return { records, nextCursor: null };

  const nextCursor = records[pageSize - 1]?.paging_token;
  if (!nextCursor) {
    throw new Error('Horizon returned an incomplete activity paging cursor.');
  }
  return { records: records.slice(0, pageSize), nextCursor };
}

export type ActivityItemLike = {
  id: string;
  hash: string;
  date: string;
  type: string;
};

export function mergeActivityItems<T extends ActivityItemLike>(current: T[], incoming: T[]): T[] {
  const merged = new Map<string, T>();
  for (const item of [...current, ...incoming]) {
    const key = item.hash ? `hash:${item.hash}` : `id:${item.id}`;
    const previous = merged.get(key);
    if (!previous || (previous.type === 'transaction' && item.type !== 'transaction')) {
      merged.set(key, item);
    }
  }
  return [...merged.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}
