import { describe, expect, it } from 'vitest';
import {
  CSV_EXPORT_COLUMNS,
  buildCsvExportQuery,
  csvCell,
  recordsToCsv,
  type CsvExportFilters,
  type CsvRow,
} from '../src/csv.js';

const baseRecord: CsvRow = {
  recipient: 'Jane Doe',
  recipientAddress: 'GRECIPIENT',
  purpose: 'School supplies',
  amount: '12.5',
  asset: 'XLM',
  network: 'testnet',
  txHash: 'txhash',
  date: '2026-01-02',
  organization: 'GORGANIZATION',
  status: 'verified',
};

const noFilters: CsvExportFilters = {
  search: '',
  orgFilter: 'all',
  assetFilter: 'all',
  networkFilter: 'all',
  statusFilter: 'all',
  fromDate: '',
  toDate: '',
};

describe('csvCell escaping', () => {
  it('quotes commas, double quotes, and line breaks', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('renders missing values as empty cells and keeps numeric values', () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
    expect(csvCell(0)).toBe('"0"');
  });
});

describe('recordsToCsv', () => {
  it('prepends the UTF-8 BOM and preserves non-ASCII text', () => {
    const csv = recordsToCsv([{ ...baseRecord, recipient: 'José — 日本語 😀' }]);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"José — 日本語 😀"');
  });

  it('uses the allowlisted header and CRLF row separators', () => {
    const csv = recordsToCsv([baseRecord, { ...baseRecord, recipient: 'Second Person' }]);

    expect(csv.slice(1).split('\r\n')).toEqual([
      CSV_EXPORT_COLUMNS.join(','),
      '"Jane Doe","GRECIPIENT","School supplies","12.5","XLM","testnet","txhash","2026-01-02","GORGANIZATION","verified"',
      '"Second Person","GRECIPIENT","School supplies","12.5","XLM","testnet","txhash","2026-01-02","GORGANIZATION","verified"',
    ]);
  });

  it('exports only the header with a BOM when no records match', () => {
    const csv = recordsToCsv([]);

    expect(csv).toBe('\uFEFF' + CSV_EXPORT_COLUMNS.join(','));
    expect(csv).not.toContain('\r\n');
  });

  it('exports only the records it is given', () => {
    const includedOne = { ...baseRecord, purpose: 'INCLUDED-ONE', status: 'verified' };
    const includedTwo = { ...baseRecord, purpose: 'INCLUDED-TWO', status: 'verified' };
    const excluded = { ...baseRecord, purpose: 'EXCLUDED-MISMATCH', status: 'mismatch' };

    const csv = recordsToCsv(
      [includedOne, excluded, includedTwo].filter((r) => r.status === 'verified'),
    );

    expect(csv).toContain('"INCLUDED-ONE"');
    expect(csv).toContain('"INCLUDED-TWO"');
    expect(csv).not.toContain('EXCLUDED-MISMATCH');
  });

  it('withholds fields that are not in the export allowlist', () => {
    const csv = recordsToCsv([
      {
        ...baseRecord,
        id: 'HIDDEN-ID',
        note: 'HIDDEN-NOTE',
        createdBy: 'HIDDEN-CREATOR',
        organizationName: 'HIDDEN-ORG-NAME',
        assetIssuer: 'HIDDEN-ISSUER',
        voidReason: 'HIDDEN-VOID-REASON',
        recipientConsent: true,
        verification: { status: 'verified', reason: 'HIDDEN-VERIFY-REASON' },
      },
    ]);

    expect(csv).toContain('"Jane Doe"');
    for (const hidden of [
      'HIDDEN-ID',
      'HIDDEN-NOTE',
      'HIDDEN-CREATOR',
      'HIDDEN-ORG-NAME',
      'HIDDEN-ISSUER',
      'HIDDEN-VOID-REASON',
      'HIDDEN-VERIFY-REASON',
    ]) {
      expect(csv).not.toContain(hidden);
    }
  });
});

describe('spreadsheet formula safety', () => {
  it('prefixes formula-like cells with an apostrophe', () => {
    for (const value of ['=1+1', '+SUM(A1)', '-2+3', '@SUM(A1)', '  =CMD()', '\t=2+2']) {
      expect(csvCell(value)).toBe('"\'' + value + '"');
    }
  });

  it('guards formula-like values inside exported records', () => {
    const csv = recordsToCsv([{ ...baseRecord, purpose: '=HYPERLINK("http://example.com")' }]);

    expect(csv).toContain('"\'=HYPERLINK(""http://example.com"")"');
  });

  it('does not guard ordinary text such as dates or hyphenated ids', () => {
    expect(csvCell('2026-01-02')).toBe('"2026-01-02"');
    expect(csvCell('A-123')).toBe('"A-123"');
  });
});

describe('buildCsvExportQuery', () => {
  it('omits cleared filters and trims the search term', () => {
    expect(buildCsvExportQuery(noFilters)).toBe('');
    expect(buildCsvExportQuery({ ...noFilters, search: '  food  ' })).toBe('q=food');
  });

  it('encodes every active filter for the export request', () => {
    const query = buildCsvExportQuery({
      search: 'food',
      orgFilter: 'GORG',
      assetFilter: 'XLM',
      networkFilter: 'testnet',
      statusFilter: 'verified',
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });
    const params = new URLSearchParams(query);

    expect(params.get('q')).toBe('food');
    expect(params.get('organization')).toBe('GORG');
    expect(params.get('asset')).toBe('XLM');
    expect(params.get('network')).toBe('testnet');
    expect(params.get('status')).toBe('verified');
    expect(params.get('from')).toBe('2026-01-01');
    expect(params.get('to')).toBe('2026-01-31');
  });
});
