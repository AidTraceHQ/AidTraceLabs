export interface ApiResponse<T> {
  data: T;
}

type CollectionKey = 'records' | 'roles' | 'entries';
type PageEnvelope = {
  hasMore?: boolean;
  nextCursor?: string | null;
  facets?: { organizations?: string[]; assets?: string[]; actions?: string[] };
};

const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();

function requestUrl(path: string): URL {
  const base = configuredBase || window.location.origin;
  return new URL(path, base.endsWith('/') ? base : base + '/');
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
  const response = await fetch(requestUrl(path), init);
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(response.ok
      ? 'The API returned an invalid response.'
      : 'API request failed with status ' + response.status + '.');
  }
  if (!response.ok) {
    const message = data !== null && typeof data === 'object' &&
      'error' in data && typeof data.error === 'string'
      ? data.error
      : 'API request failed with status ' + response.status + '.';
    throw new Error(message);
  }
  return { data: data as T };
}

async function getAllPages<TItem>(
  path: string,
  collection: CollectionKey,
): Promise<ApiResponse<PageEnvelope & Partial<Record<CollectionKey, TItem[]>>>> {
  const combined: TItem[] = [];
  const seenCursors = new Set<string>();
  const url = requestUrl(path);
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
