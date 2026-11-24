import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  formatAmount,
  formatDate,
  formatDisplayAmount,
  resolveMessage,
} from '../src/localization.js';

describe('localization groundwork', () => {
  it('uses the default locale when a message or requested locale is missing', () => {
    const resources = {
      [DEFAULT_LOCALE]: {
        recordDetails: 'AID RECORD DETAILS',
        amount: 'Amount',
      },
      fr: {
        recordDetails: 'DÉTAILS DU DOSSIER',
      },
    };

    expect(resolveMessage('recordDetails', 'fr-CA', resources)).toBe('DÉTAILS DU DOSSIER');
    expect(resolveMessage('amount', 'fr-CA', resources)).toBe('Amount');
    expect(resolveMessage('amount', 'de-DE', resources)).toBe('Amount');
  });

  it('formats dates with the requested locale', () => {
    const value = '2026-03-04T12:30:00.000Z';

    expect(formatDate(value, 'de-DE')).toBe(
      new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      ),
    );
    expect(formatDate('not-a-date', 'de-DE')).toBe('—');
  });

  it('formats exact decimal amounts for display without changing canonical amounts', () => {
    const canonicalAmount = '001234567.0500';
    const previousCanonicalOutput = BigInt('001234567').toLocaleString() + '.0500';

    expect(formatAmount(canonicalAmount)).toBe(previousCanonicalOutput);
    expect(formatDisplayAmount(canonicalAmount, 'de-DE')).toBe('1.234.567,0500');
    expect(canonicalAmount).toBe('001234567.0500');
  });
});
