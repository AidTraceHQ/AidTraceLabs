import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/api.js';

afterEach(() => vi.unstubAllGlobals());

describe('beneficiary filter request building', () => {
  it('passes status and date range to /api/beneficiary', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          records: [
            {
              id: 'rec-1',
              recipient: 'Alice',
              recipientAddress: 'GBeneficiary1',
              purpose: 'Food aid',
              amount: '100',
              asset: 'USDC',
              network: 'testnet',
              txHash: 'a'.repeat(64),
              date: '2026-01-15',
              note: '',
              status: 'verified',
              organization: 'GOrg1',
              organizationName: 'Org One',
              createdAt: '2026-01-15T00:00:00Z',
              createdBy: 'GOrg1',
              recipientConsent: false,
              version: 1,
            },
          ],
          nextCursor: null,
          hasMore: false,
          total: 1,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.getAllPages<AidRecord>('/api/beneficiary?status=verified&from=2026-01-01&to=2026-01-31', 'records');
    expect(result.data.records).toHaveLength(1);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('/api/beneficiary');
    expect(url).toContain('status=verified');
    expect(url).toContain('from=2026-01-01');
    expect(url).toContain('to=2026-01-31');
  });

  it('clears all filters and requests the full set', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          records: [
            {
              id: 'rec-1',
              recipient: 'Alice',
              recipientAddress: 'GBeneficiary1',
              purpose: 'Food aid',
              amount: '100',
              asset: 'USDC',
              network: 'testnet',
              txHash: 'a'.repeat(64),
              date: '2026-01-15',
              note: '',
              status: 'verified',
              organization: 'GOrg1',
              organizationName: 'Org One',
              createdAt: '2026-01-15T00:00:00Z',
              createdBy: 'GOrg1',
              recipientConsent: false,
              version: 1,
            },
            {
              id: 'rec-2',
              recipient: 'Bob',
              recipientAddress: 'GBeneficiary2',
              purpose: 'Cash aid',
              amount: '200',
              asset: 'XLM',
              network: 'testnet',
              txHash: 'b'.repeat(64),
              date: '2026-02-15',
              note: '',
              status: 'mismatch',
              organization: 'GOrg2',
              organizationName: 'Org Two',
              createdAt: '2026-02-15T00:00:00Z',
              createdBy: 'GOrg2',
              recipientConsent: false,
              version: 1,
            },
          ],
          nextCursor: null,
          hasMore: false,
          total: 2,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.getAllPages<AidRecord>('/api/beneficiary', 'records');
    expect(result.data.records).toHaveLength(2);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toBe('/api/beneficiary?limit=100');
  });

  it('rejects attempts to change wallet scope via query params', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          records: [
            {
              id: 'rec-1',
              recipient: 'Alice',
              recipientAddress: 'GBeneficiary1',
              purpose: 'Food aid',
              amount: '100',
              asset: 'USDC',
              network: 'testnet',
              txHash: 'a'.repeat(64),
              date: '2026-01-15',
              note: '',
              status: 'verified',
              organization: 'GOrg1',
              organizationName: 'Org One',
              createdAt: '2026-01-15T00:00:00Z',
              createdBy: 'GOrg1',
              recipientConsent: false,
              version: 1,
            },
          ],
          nextCursor: null,
          hasMore: false,
          total: 1,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.getAllPages<AidRecord>(
      '/api/beneficiary?recipientAddress=GBeneficiaryAttacker&organization=GOrgAttacker',
      'records',
    );
    expect(result.data.records).toHaveLength(1);
    // The server enforces scoping; the client must not be able to override it.
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('/api/beneficiary');
    expect(url).toContain('recipientAddress=GBeneficiaryAttacker');
    expect(url).toContain('organization=GOrgAttacker');
  });
});

type AidRecord = {
  id: string;
  recipient: string;
  recipientAddress: string;
  purpose: string;
  amount: string;
  asset: string;
  assetIssuer?: string;
  network: string;
  txHash: string;
  date: string;
  note: string;
  status: string;
  organization: string;
  organizationName?: string;
  createdAt: string;
  createdBy: string;
  recipientConsent?: boolean;
  version: number;
};