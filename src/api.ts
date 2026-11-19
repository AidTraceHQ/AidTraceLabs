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

export type Role = 'donor' | 'organization' | 'beneficiary' | 'admin';
export type Network = 'testnet' | 'mainnet';
export type Session = {
  address: string;
  network: Network;
  role: Role;
  expiresAt: string;
  csrfToken: string;
};

export const SESSION_REFRESH_MIN_INTERVAL_MS = 1000;

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

async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
  const headers = new Headers({ Accept: 'application/json' });
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
    const apiError = new ApiError(method, path, response.status, message);
    if (path !== '/api/me' && isSessionAuthError(apiError)) sessionAuthErrorHandler?.(apiError);
    throw apiError;
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

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  getRecord: <T>(id: string) =>
    request<{ record: T }>('GET', '/api/records/' + encodeURIComponent(id)),
  getAllPages,
  getPage,
  post: <T = unknown>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T = unknown>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T = unknown>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};

let sessionAuthErrorHandler: ((error: ApiError) => void) | undefined;

export function setSessionAuthErrorHandler(handler?: (error: ApiError) => void): void {
  sessionAuthErrorHandler = handler;
}

export function isSessionAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export function sessionHasRole(session: Session | null, role: Role): boolean {
  return session?.role === role;
}

export type SessionState = {
  getSession: () => Session | null;
  subscribe: (listener: () => void) => () => void;
  setSession: (session: Session | null) => void;
  refresh: (options?: { force?: boolean }) => Promise<Session | null>;
  onAuthError: (error: unknown) => Promise<Session | null> | null;
};

function sameSession(left: Session | null, right: Session | null): boolean {
  return (
    left === right ||
    (!!left &&
      !!right &&
      left.address === right.address &&
      left.network === right.network &&
      left.role === right.role &&
      left.expiresAt === right.expiresAt &&
      left.csrfToken === right.csrfToken)
  );
}

export function createSessionState(options: { minIntervalMs?: number } = {}): SessionState {
  const minIntervalMs = options.minIntervalMs ?? SESSION_REFRESH_MIN_INTERVAL_MS;
  let current: Session | null = null;
  let lastAttempt = Number.NEGATIVE_INFINITY;
  let inFlight: Promise<Session | null> | undefined;
  const listeners = new Set<() => void>();

  const setSession = (session: Session | null) => {
    if (sameSession(current, session)) return;
    current = session;
    for (const listener of [...listeners]) listener();
  };

  const state: SessionState = {
    getSession: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setSession,
    refresh({ force = false } = {}) {
      if (inFlight) return inFlight;
      const now = Date.now();
      if (!force && now - lastAttempt < minIntervalMs) return Promise.resolve(current);
      lastAttempt = now;
      inFlight = api
        .get<{ session: Session | null }>('/api/me')
        .then((response) => {
          setSession(response.data.session);
          return response.data.session;
        })
        .catch(() => current)
        .finally(() => {
          inFlight = undefined;
        });
      return inFlight;
    },
    onAuthError(error) {
      if (!isSessionAuthError(error)) return null;
      setSession(null);
      return state.refresh({ force: true });
    },
  };
  return state;
}

export function attachSessionFocusRefresh(
  state: SessionState,
  target: EventTarget = window,
): () => void {
  const onFocus = () => {
    void state.refresh();
  };
  target.addEventListener('focus', onFocus);
  return () => target.removeEventListener('focus', onFocus);
}
