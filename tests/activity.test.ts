import { describe, expect, it } from 'vitest';
import {
  HORIZON_ACTIVITY_PAGE_SIZE,
  mergeActivityItems,
  parseHorizonActivityPage,
} from '../src/activity.js';

describe('Horizon activity paging', () => {
  it('keeps the first page bounded and uses the last visible paging token as its cursor', () => {
    const records = Array.from({ length: HORIZON_ACTIVITY_PAGE_SIZE + 1 }, (_, index) => ({
      id: String(index),
      paging_token: `token-${index}`,
    }));

    const page = parseHorizonActivityPage({ _embedded: { records } });

    expect(page.records).toHaveLength(HORIZON_ACTIVITY_PAGE_SIZE);
    expect(page.nextCursor).toBe(`token-${HORIZON_ACTIVITY_PAGE_SIZE - 1}`);
    expect(records[HORIZON_ACTIVITY_PAGE_SIZE]?.paging_token).not.toBe(page.nextCursor);
  });

  it('does not expose a load-more cursor when the response has no additional row', () => {
    const records = Array.from({ length: HORIZON_ACTIVITY_PAGE_SIZE }, (_, index) => ({
      paging_token: `token-${index}`,
    }));

    expect(parseHorizonActivityPage({ _embedded: { records } })).toEqual({
      records,
      nextCursor: null,
    });
  });

  it('rejects an additional page without a usable paging token', () => {
    const records = Array.from({ length: HORIZON_ACTIVITY_PAGE_SIZE + 1 }, () => ({}));
    expect(() => parseHorizonActivityPage({ _embedded: { records } })).toThrow(
      'Horizon returned an incomplete activity paging cursor.',
    );
  });

  it('merges separate pages, deduplicates transaction/payment hashes, and sorts newest first', () => {
    const current = [
      {
        id: 'transaction-1',
        hash: 'shared-hash',
        date: '2026-01-01T00:00:00Z',
        type: 'transaction',
      },
      {
        id: 'payment-2',
        hash: 'payment-hash',
        date: '2026-01-02T00:00:00Z',
        type: 'received',
      },
    ];
    const older = [
      {
        id: 'payment-1',
        hash: 'shared-hash',
        date: '2026-01-01T00:00:00Z',
        type: 'sent',
      },
      {
        id: 'transaction-3',
        hash: 'older-hash',
        date: '2025-12-31T00:00:00Z',
        type: 'transaction',
      },
    ];

    expect(mergeActivityItems(current, older)).toEqual([current[1], older[0], older[1]]);
  });
});
