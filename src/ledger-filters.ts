export const LEDGER_FILTER_KEYS = ["status", "type", "from", "to", "asset"] as const;

export type LedgerFilterKey = (typeof LEDGER_FILTER_KEYS)[number];

export type LedgerFilters = Partial<Record<LedgerFilterKey, string>>;

const FILTER_VALUE_PATTERN = /^[A-Za-z0-9 _:\-.]{1,64}$/;

/**
 * Parse supported ledger filter keys from a URL search string.
 * Unknown keys, empty values, and values that do not match the allowed
 * pattern are ignored so that session tokens or arbitrary data are never
 * reflected into component state.
 */
export function parseLedgerFilters(search: string): LedgerFilters {
  const params = new URLSearchParams(search);
  const filters: LedgerFilters = {};
  for (const key of LEDGER_FILTER_KEYS) {
    const value = params.get(key);
    if (value !== null && value.length > 0 && FILTER_VALUE_PATTERN.test(value)) {
      filters[key] = value;
    }
  }
  return filters;
}

/**
 * Build a search string containing only supported, non-empty filter keys.
 * Returns an empty string when there are no active filters.
 */
export function serializeLedgerFilters(filters: LedgerFilters): string {
  const params = new URLSearchParams();
  for (const key of LEDGER_FILTER_KEYS) {
    const value = filters[key];
    if (value !== undefined && value.length > 0 && FILTER_VALUE_PATTERN.test(value)) {
      params.set(key, value);
    }
  }
  const search = params.toString();
  return search.length > 0 ? `?${search}` : "";
}

/**
 * Replace the current history entry's search string with the given filters,
 * preserving the pathname and hash and any non-filter query keys.
 */
export function syncLedgerFiltersToUrl(
  filters: LedgerFilters,
  location: Pick<Location, "pathname" | "search" | "hash"> = window.location,
  history: Pick<History, "replaceState"> & { state?: unknown } = window.history,
): void {
  const current = new URLSearchParams(location.search);
  for (const key of LEDGER_FILTER_KEYS) {
    current.delete(key);
  }
  const next = new URLSearchParams(serializeLedgerFilters(filters));
  next.forEach((value, key) => current.set(key, value));
  const search = current.toString();
  const url = `${location.pathname}${search.length > 0 ? `?${search}` : ""}${location.hash}`;
  history.replaceState(history.state ?? null, "", url);
}
