import { describe, expect, it } from 'vitest';
import {
  EMPTY_VIEW_SEARCHES,
  filterActivity,
  isActivityRangeInvalid,
  ledgerQueryString,
  setViewSearch,
  type ActivityFilterItem,
  type ViewSearches,
} from '../src/activity-filters.js';

const activity: ActivityFilterItem[] = [
  {
    hash: 'aaa111',
    type: 'sent',
    asset: 'XLM',
    counterparty: 'GFOOD',
    date: '2026-11-01T10:00:00Z',
  },
  {
    hash: 'bbb222',
    type: 'received',
    asset: 'USDC',
    counterparty: 'GWATER',
    date: '2026-11-05T10:00:00Z',
  },
  {
    hash: 'ccc333',
    type: 'sent',
    asset: 'USDC',
    counterparty: 'GSHELTER',
    date: '2026-11-09T10:00:00Z',
  },
];

const ledgerFilters = {
  organization: 'org-1',
  asset: 'all',
  network: 'testnet',
  status: 'all',
  from: '2026-11-01',
  to: '',
};

// Mirrors how App derives each view from the per-view search state.
const ledgerQueryFor = (s: ViewSearches) =>
  ledgerQueryString({ ...ledgerFilters, search: s.ledger });
const activityFor = (s: ViewSearches) =>
  filterActivity(activity, { search: s.activity, type: 'all', from: '', to: '' });

// Typing replays each keystroke as a new search value, like the input's onChange.
function typeInto(s: ViewSearches, view: 'ledger' | 'activity', text: string): ViewSearches {
  let next = s;
  for (let i = 1; i <= text.length; i++) next = setViewSearch(next, view, text.slice(0, i));
  return next;
}

describe('activity and ledger search are independent', () => {
  it('typing in activity search does not change the ledger search or query', () => {
    const start = setViewSearch(EMPTY_VIEW_SEARCHES, 'ledger', 'food');
    const before = ledgerQueryFor(start);

    const after = typeInto(start, 'activity', 'water');

    expect(after.activity).toBe('water');
    expect(after.ledger).toBe('food');
    expect(ledgerQueryFor(after)).toBe(before);
    expect(before).toBe('q=food&organization=org-1&network=testnet&from=2026-11-01');
  });

  it('typing in ledger search does not change activity results', () => {
    const start = setViewSearch(EMPTY_VIEW_SEARCHES, 'activity', 'usdc');
    const before = activityFor(start);

    const after = typeInto(start, 'ledger', 'shelter');

    expect(activityFor(after)).toEqual(before);
    expect(before.map((a) => a.hash)).toEqual(['bbb222', 'ccc333']);
    expect(ledgerQueryFor(after)).toContain('q=shelter');
  });

  it("switching views preserves each view's own search", () => {
    let s = typeInto(EMPTY_VIEW_SEARCHES, 'ledger', 'food');
    s = typeInto(s, 'activity', 'gwater');
    // Back on the ledger tab: clearing the ledger search leaves the activity search alone.
    s = setViewSearch(s, 'ledger', '');

    expect(s).toEqual({ ledger: '', activity: 'gwater' });
    expect(ledgerQueryFor(s)).toBe('organization=org-1&network=testnet&from=2026-11-01');
    expect(activityFor(s).map((a) => a.hash)).toEqual(['bbb222']);
  });
});

describe('activity filter helper', () => {
  it('matches hash, type, asset and counterparty case-insensitively', () => {
    const f = { type: 'all', from: '', to: '' };
    expect(filterActivity(activity, { ...f, search: 'AAA' }).map((a) => a.hash)).toEqual([
      'aaa111',
    ]);
    expect(filterActivity(activity, { ...f, search: 'received' }).map((a) => a.hash)).toEqual([
      'bbb222',
    ]);
    expect(filterActivity(activity, { ...f, search: 'gshelter' }).map((a) => a.hash)).toEqual([
      'ccc333',
    ]);
    expect(filterActivity(activity, { ...f, search: '' })).toHaveLength(3);
  });

  it('filters by type and an inclusive date range; an inverted range is ignored', () => {
    expect(
      filterActivity(activity, { search: '', type: 'sent', from: '', to: '' }).map((a) => a.hash),
    ).toEqual(['aaa111', 'ccc333']);
    expect(
      filterActivity(activity, {
        search: '',
        type: 'all',
        from: '2026-11-05',
        to: '2026-11-09',
      }).map((a) => a.hash),
    ).toEqual(['bbb222', 'ccc333']);
    expect(isActivityRangeInvalid('2026-11-09', '2026-11-01')).toBe(true);
    expect(
      filterActivity(activity, { search: '', type: 'all', from: '2026-11-09', to: '2026-11-01' }),
    ).toHaveLength(3);
  });

  it('ledger query omits "all" filters and trims the search', () => {
    expect(
      ledgerQueryString({
        ...ledgerFilters,
        organization: 'all',
        network: 'all',
        from: '',
        search: '  x  ',
      }),
    ).toBe('q=x');
    expect(ledgerQueryString({ ...ledgerFilters, search: '   ' })).not.toContain('q=');
  });

  it('setViewSearch returns the same object when nothing changes', () => {
    const s = setViewSearch(EMPTY_VIEW_SEARCHES, 'activity', 'a');
    expect(setViewSearch(s, 'activity', 'a')).toBe(s);
  });
});
