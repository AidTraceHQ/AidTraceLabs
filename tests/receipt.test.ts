import { describe, expect, it } from 'vitest';
import { formatReceipt, type ReceiptRecord } from '../src/receipt.js';

const record: ReceiptRecord = {
  id: 'record-1234',
  recipient: 'Amina Example',
  recipientAddress: 'G'.padEnd(56, 'A'),
  recipientConsent: true,
  purpose: 'Emergency housing',
  amount: '125.5000000',
  asset: 'USDC',
  network: 'testnet',
  txHash: 'a'.repeat(64),
  date: '2026-11-18',
  note: 'Rent support',
  organizationName: 'Community Aid',
  status: 'verified',
  verification: {
    status: 'verified',
    checkedAt: '2026-11-18T12:00:00.000Z',
    amount: '125.5000000',
    asset: 'USDC',
  },
};

describe('receipt formatting', () => {
  it('clearly separates entered record data from Horizon verification', () => {
    const receipt = formatReceipt(record);

    expect(receipt).toContain('Network: testnet');
    expect(receipt).toContain('USER-ENTERED RECORD DATA');
    expect(receipt).toContain('HORIZON-DERIVED VERIFICATION');
    expect(receipt).toContain('Aid amount: 125.5000000 USDC');
    expect(receipt).toContain('Horizon amount: 125.5000000');
    expect(receipt).toContain('Verification state: Verified on-chain');
    expect(receipt).toContain(
      'Limitation: Horizon verification checks public Stellar transaction fields only.',
    );
  });

  it('withholds beneficiary identity and consented details when consent is off', () => {
    const receipt = formatReceipt({ ...record, recipientConsent: false });

    expect(receipt).toContain('Beneficiary: Beneficiary (identity withheld)');
    expect(receipt).toContain('Beneficiary wallet: Withheld by consent settings');
    expect(receipt).toContain('Transaction hash: Withheld by consent settings');
    expect(receipt).toContain('Note: Withheld by consent settings');
    expect(receipt).not.toContain(record.recipient);
    expect(receipt).not.toContain(record.recipientAddress);
    expect(receipt).not.toContain(record.txHash);
    expect(receipt).not.toContain(record.note);
  });

  it('reports Horizon mismatches distinctly from the entered amount', () => {
    const receipt = formatReceipt({
      ...record,
      status: 'mismatch',
      verification: {
        status: 'mismatch',
        checkedAt: '2026-11-18T12:00:00.000Z',
        amount: '120',
      },
    });

    expect(receipt).toContain('Aid amount: 125.5000000 USDC');
    expect(receipt).toContain('Verification state: Mismatch');
    expect(receipt).toContain('Horizon amount: 120');
  });

  it('identifies a missing transaction hash and excludes tokens and unlisted wallet data', () => {
    const recordWithPrivateExtras = {
      ...record,
      txHash: '',
      csrfToken: 'session-token-secret',
      wallet: 'hidden-wallet-secret',
      organization: 'organization-wallet-secret',
      verification: {
        status: 'verified',
        checkedAt: '2026-11-18T12:00:00.000Z',
        amount: '125.5000000',
        asset: 'USDC',
        sourceAccount: 'horizon-source-wallet-secret',
        destination: 'horizon-destination-wallet-secret',
      },
    };
    const receipt = formatReceipt(recordWithPrivateExtras);

    expect(receipt).toContain('Transaction hash: Not supplied');
    expect(receipt).not.toContain('session-token-secret');
    expect(receipt).not.toContain('hidden-wallet-secret');
    expect(receipt).not.toContain('organization-wallet-secret');
    expect(receipt).not.toContain('horizon-source-wallet-secret');
    expect(receipt).not.toContain('horizon-destination-wallet-secret');
  });

  it('normalizes whitespace in user-provided text', () => {
    const receipt = formatReceipt({ ...record, purpose: '  Emergency\n  housing  ' });

    expect(receipt).toContain('Purpose: Emergency housing');
    expect(receipt).not.toContain('Emergency\n  housing');
  });
});
