import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localDateString } from '../src/date.js';

describe('localDateString', () => {
  const originalTimeZone = process.env.TZ;

  afterEach(() => {
    vi.useRealTimers();
    if (originalTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTimeZone;
    }
  });

  describe('time zones', () => {
    beforeEach(() => {
      process.env.TZ = 'Asia/Tokyo';
    });

    it('returns the local date ahead of UTC (08:00 in Tokyo is still the previous day in UTC)', () => {
      const instant = new Date('2026-11-21T23:00:00Z');
      expect(instant.toISOString().slice(0, 10)).toBe('2026-11-21');
      expect(localDateString(instant)).toBe('2026-11-22');
    });

    it('returns the local date behind UTC (23:00 in New York is already the next day in UTC)', () => {
      process.env.TZ = 'America/New_York';
      const instant = new Date('2026-11-23T04:00:00Z');
      expect(instant.toISOString().slice(0, 10)).toBe('2026-11-23');
      expect(localDateString(instant)).toBe('2026-11-22');
    });
  });

  it('pads single-digit months and days', () => {
    process.env.TZ = 'UTC';
    expect(localDateString(new Date('2026-01-05T12:00:00Z'))).toBe('2026-01-05');
  });

  it('uses the current time when no date is given', () => {
    process.env.TZ = 'Asia/Tokyo';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-21T23:00:00Z'));
    expect(localDateString()).toBe('2026-11-22');
  });
});
