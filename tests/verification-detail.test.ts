import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VerificationDetail, type VerificationDetailRecord } from '../src/verification-detail.js';

function renderDetail(record: VerificationDetailRecord): string {
  return renderToStaticMarkup(
    createElement('dl', null, createElement(VerificationDetail, { record })),
  );
}

const checkedAt = '2026-01-15T10:30:00.000Z';

describe('verification detail check time', () => {
  for (const status of ['verified', 'mismatch', 'not-found', 'pending']) {
    it(`shows the last check time for a ${status} result`, () => {
      const markup = renderDetail({ verification: { status, checkedAt, differences: [] } });

      expect(markup).toContain('Last verification check');
      expect(markup).toContain('aria-label="Last verification check time"');
      expect(markup).toContain('2026');
      expect(markup).not.toContain('No verification check recorded');
    });
  }

  it('distinguishes the check time from the transaction creation time', () => {
    const markup = renderDetail({
      verification: {
        status: 'verified',
        checkedAt,
        createdAt: '2026-01-10T08:00:00.000Z',
        differences: [],
      },
    });

    expect(markup).toContain('Last verification check');
    expect(markup).toContain('Transaction created');
    expect(markup).toContain('2026');
  });

  it('renders a neutral fallback when checkedAt is missing or invalid', () => {
    expect(renderDetail({})).toContain('No verification check recorded');
    expect(
      renderDetail({ verification: { status: 'pending', checkedAt: '', differences: [] } }),
    ).toContain('No verification check recorded');
    expect(
      renderDetail({
        verification: { status: 'pending', checkedAt: 'not-a-date', differences: [] },
      }),
    ).toContain('No verification check recorded');
  });

  it('does not render withheld verification evidence in a consent-off projection', () => {
    const consentOff: VerificationDetailRecord & Record<string, unknown> = {
      recipientAddress: '',
      txHash: '',
      recipientConsent: false,
      verification: {
        status: 'verified',
        checkedAt,
        differences: [],
      },
    };

    const markup = renderDetail(consentOff);

    expect(markup).toContain('Last verification check');
    expect(markup).toContain('2026');
    expect(markup).not.toContain('Ledger');
    expect(markup).not.toContain('Memo');
    expect(markup).not.toContain('Transaction created');
    expect(markup).not.toContain('Withheld without consent');
  });
});
