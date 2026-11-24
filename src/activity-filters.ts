/**
 * Search and filter helpers for the public ledger and the wallet activity views.
 *
 * Each view keeps its own search text, so typing in the activity search never
 * changes the ledger query (and the reverse).
 */

export type SearchView = 'ledger' | 'activity';
export type ViewSearches = Readonly<Record<SearchView, string>>;

export const EMPTY_VIEW_SEARCHES: ViewSearches = { ledger: '', activity: '' };

/** Return `searches` with `view`'s search text set to `value`; the other view is untouched. */
export function setViewSearch(
  searches: ViewSearches,
  view: SearchView,
  value: string,
): ViewSearches {
  return searches[view] === value ? searches : { ...searches, [view]: value };
}

export type LedgerQueryFilters = {
  search: string;
  organization: string;
  asset: string;
  network: string;
  status: string;
  from: string;
  to: string;
};

/** Query string for `/api/transparency` (without the leading `?`). `'all'` means no filter. */
export function ledgerQueryString(filters: LedgerQueryFilters): string {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('q', filters.search.trim());
  if (filters.organization !== 'all') params.set('organization', filters.organization);
  if (filters.asset !== 'all') params.set('asset', filters.asset);
  if (filters.network !== 'all') params.set('network', filters.network);
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return params.toString();
}

export type ActivityFilterItem = {
  hash: string;
  type: string;
  asset: string;
  counterparty: string;
  date: string;
};

export type ActivityFilters = {
  search: string;
  type: string;
  from: string;
  to: string;
};

/** True when both dates are set and `from` is after `to`; the date range is then ignored. */
export function isActivityRangeInvalid(from: string, to: string): boolean {
  return Boolean(from && to && from > to);
}

/** Wallet activity rows matching the activity view's own search, type and date range. */
export function filterActivity<T extends ActivityFilterItem>(
  items: readonly T[],
  filters: ActivityFilters,
): T[] {
  const rangeInvalid = isActivityRangeInvalid(filters.from, filters.to);
  const needle = filters.search.toLowerCase();
  return items.filter(
    (a) =>
      [a.hash, a.type, a.asset, a.counterparty].join(' ').toLowerCase().includes(needle) &&
      (filters.type === 'all' || a.type === filters.type) &&
      (rangeInvalid || !filters.from || a.date.slice(0, 10) >= filters.from) &&
      (rangeInvalid || !filters.to || a.date.slice(0, 10) <= filters.to),
  );
}
