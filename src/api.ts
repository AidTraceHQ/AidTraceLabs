export interface ApiResponse<T> {
  data: T;
}

export class ApiError extends Error {
  constructor(method: string, path: string, status: number, message: string) {
    super(method + ' ' + path + ' failed (' + status + '): ' + message);
    this.name = 'ApiError';
    this.status = status;
  }

  readonly status: number;
}

type CollectionKey = 'records' | 'roles' | 'entries';
export type PageEnvelope = {
  hasMore?: boolean;
  nextCursor?: string | null;
  total?: number;
  facets?: { organizations?: string[]; assets?: string[]; actions?: string[] };
  summary?: {
    byStatus?: {
      status: 'verified' | 'mismatch' | 'not-found' | 'unverified' | 'pending' | 'voided';
      asset: string;
      amount: string;
    }[];
  };
};

const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim() || '';

export function resolveApiUrl(
  path: string,
  base = configuredBase,
  origin = window.location.origin,
): string {
  if (!base) return path;
  const normalizedBase = base.endsWith('/') ? base : base + '/';
  return new URL(path, normalizedBase || origin).toString();
}

export type RequestOptions = {
  headers?: Record<string, string>;
};

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const headers = new Headers({ Accept: 'application/json' });
  if (options.headers) {
    for (const [name, value] of Object.entries(options.headers)) {
      headers.set(name, value);
    }
  }
  const init: RequestInit = {
    method,
    headers,
    credentials: 'include',
    cache: 'no-store',
  };
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
    init.body = JSON.stringify(body);
  }
  let response: Response;
  try {
    response = await fetch(resolveApiUrl(path), init);
  } catch (error) {
    const detail = error instanceof Error ? ': ' + error.message : '';
    const requestError = new Error(method + ' ' + path + ' failed' + detail);
    Object.defineProperty(requestError, 'cause', { value: error });
    throw requestError;
  }
  const failurePrefix = method + ' ' + path + ' failed (' + response.status + ')';
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      response.ok
        ? method + ' ' + path + ' returned an invalid response.'
        : failurePrefix + ': the API returned an invalid response.',
    );
  }
  if (!response.ok) {
    const message =
      data !== null && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'request was rejected.';
    throw new ApiError(method, path, response.status, message);
  }
  return { data: data as T };
}

async function getAllPages<TItem>(
  path: string,
  collection: CollectionKey,
): Promise<ApiResponse<PageEnvelope & Partial<Record<CollectionKey, TItem[]>>>> {
  const combined: TItem[] = [];
  const seenCursors = new Set<string>();
  const url = new URL(path, window.location.origin);
  url.searchParams.set('limit', '100');
  let cursor: string | null = null;
  let finalPage: PageEnvelope & Partial<Record<CollectionKey, TItem[]>>;

  while (true) {
    if (cursor) url.searchParams.set('cursor', cursor);
    else url.searchParams.delete('cursor');
    const response = await request<PageEnvelope & Partial<Record<CollectionKey, TItem[]>>>(
      'GET',
      url.pathname + url.search,
    );
    const page = response.data;
    finalPage = page;
    const items = page[collection];
    if (!Array.isArray(items)) {
      throw new Error('The API response is missing its ' + collection + ' collection.');
    }
    combined.push(...items);
    cursor = typeof page.nextCursor === 'string' ? page.nextCursor : null;
    if (page.hasMore === true && !cursor) {
      throw new Error('The API returned an incomplete pagination cursor.');
    }
    if (cursor && seenCursors.has(cursor)) {
      throw new Error('The API returned a repeated pagination cursor.');
    }
    if (cursor) seenCursors.add(cursor);
    if (!cursor || page.hasMore !== true) break;
  }
  return { data: { ...finalPage, [collection]: combined } };
}

async function getPage<TItem>(
  path: string,
  collection: CollectionKey,
  options: { limit?: number; cursor?: string | null; seenCursors?: Set<string> } = {},
): Promise<ApiResponse<PageEnvelope & Partial<Record<CollectionKey, TItem[]>>>> {
  const url = new URL(path, window.location.origin);
  url.searchParams.set('limit', String(options.limit ?? 20));
  if (options.cursor) url.searchParams.set('cursor', options.cursor);
  else url.searchParams.delete('cursor');

  const response = await request<PageEnvelope & Partial<Record<CollectionKey, TItem[]>>>(
    'GET',
    url.pathname + url.search,
  );
  const page = response.data;
  const items = page[collection];
  if (!Array.isArray(items)) {
    throw new Error('The API response is missing its ' + collection + ' collection.');
  }
  // Treat the cursor as an opaque string. Do not base64-decode or parse it in the UI.
  const cursor = typeof page.nextCursor === 'string' ? page.nextCursor : null;
  if (page.hasMore === true && !cursor) {
    throw new Error('The API returned an incomplete pagination cursor.');
  }
  if (cursor && options.seenCursors?.has(cursor)) {
    throw new Error('The API returned a repeated pagination cursor.');
  }
  if (cursor && options.seenCursors) options.seenCursors.add(cursor);
  return { data: page };
}

/** Reset a ledger cursor stack to the first page (no cursor). */
export function resetCursorStack(): Array<string | null> {
  return [null];
}

/** Generate a client-side idempotency key for a create request. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'idem-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  getRecord: <T>(id: string) =>
    request<{ record: T }>('GET', '/api/records/' + encodeURIComponent(id)),
  getAllPages,
  getPage,
  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, body, options),
  put: <T = unknown>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T = unknown>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};
