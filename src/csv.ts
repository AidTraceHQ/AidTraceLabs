export const CSV_EXPORT_COLUMNS = [
  'recipient',
  'recipientAddress',
  'purpose',
  'amount',
  'asset',
  'network',
  'txHash',
  'date',
  'organization',
  'status',
] as const;

export type CsvRow = Record<string, unknown>;

export type CsvExportFilters = {
  search: string;
  orgFilter: string;
  assetFilter: string;
  networkFilter: string;
  statusFilter: string;
  fromDate: string;
  toDate: string;
};

const FORMULA_PREFIX = /^\s*[=+\-@]/;

export function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = FORMULA_PREFIX.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export function recordsToCsv(
  records: readonly CsvRow[],
  columns: readonly string[] = CSV_EXPORT_COLUMNS,
): string {
  const lines = [columns.join(',')];
  for (const record of records) {
    lines.push(columns.map((column) => csvCell(record[column])).join(','));
  }
  return '\ufeff' + lines.join('\r\n');
}

export function buildCsvExportQuery(filters: CsvExportFilters): string {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('q', filters.search.trim());
  if (filters.orgFilter !== 'all') params.set('organization', filters.orgFilter);
  if (filters.assetFilter !== 'all') params.set('asset', filters.assetFilter);
  if (filters.networkFilter !== 'all') params.set('network', filters.networkFilter);
  if (filters.statusFilter !== 'all') params.set('status', filters.statusFilter);
  if (filters.fromDate) params.set('from', filters.fromDate);
  if (filters.toDate) params.set('to', filters.toDate);
  return params.toString();
}
