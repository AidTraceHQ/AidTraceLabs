import { describe, expect, it } from 'vitest';
import { shouldRestartFromFirstPage } from '../src/pagination.js';

describe('shouldRestartFromFirstPage', () => {
  it('restarts when a page after the first comes back empty', () => {
    expect(shouldRestartFromFirstPage(1, 0)).toBe(true);
    expect(shouldRestartFromFirstPage(2, 0)).toBe(true);
  });

  it('never restarts from the first page, even when it is empty', () => {
    expect(shouldRestartFromFirstPage(0, 0)).toBe(false);
  });

  it('keeps a page that has records', () => {
    expect(shouldRestartFromFirstPage(1, 3)).toBe(false);
    expect(shouldRestartFromFirstPage(0, 10)).toBe(false);
  });
});
