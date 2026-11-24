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
