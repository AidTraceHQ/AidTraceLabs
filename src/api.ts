export interface ApiResponse<T> {
  data: T;
}

type CollectionKey = 'records' | 'roles' | 'entries';
type PageEnvelope = {
  hasMore?: boolean;
  nextCursor?: string | null;
  facets?: { organizations?: string[]; assets?: string[]; actions?: string[] };
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
    throw new Error(method + ' ' + path + ' failed' + detail);
  }
  const failurePrefix = method + ' ' + path + ' failed (' + response.status + ')';
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(response.ok
      ? method + ' ' + path + ' returned an invalid response.'
      : failurePrefix + ': the API returned an invalid response.');
  }
  if (!response.ok) {
    const message = data !== null && typeof data === 'object' &&
      'error' in data && typeof data.error === 'string'
      ? data.error
      : 'request was rejected.';
    throw new Error(failurePrefix + ': ' + message);
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
  let finalPage: (PageEnvelope & Partial<Record<CollectionKey, TItem[]>>) | null = null;

  do {
    if (cursor) url.searchParams.set('cursor', cursor);
    else url.searchParams.delete('cursor');
    const response = await request<PageEnvelope & Partial<Record<CollectionKey, TItem[]>>>(
      'GET',
      url.pathname + url.search,
    );
    finalPage = response.data;
    const items = finalPage[collection];
    if (!Array.isArray(items)) {
      throw new Error('The API response is missing its ' + collection + ' collection.');
    }
    combined.push(...items);
    cursor = typeof finalPage.nextCursor === 'string' ? finalPage.nextCursor : null;
    if (finalPage.hasMore === true && !cursor) {
      throw new Error('The API returned an incomplete pagination cursor.');
    }
    if (cursor && seenCursors.has(cursor)) {
      throw new Error('The API returned a repeated pagination cursor.');
    }
    if (cursor) seenCursors.add(cursor);
  } while (cursor && finalPage?.hasMore === true);

  if (!finalPage) throw new Error('The API returned no list page.');
  return { data: { ...finalPage, [collection]: combined } };
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  getAllPages,
  post: <T = unknown>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T = unknown>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T = unknown>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};
