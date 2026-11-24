export type ReceiptRecord = {
  id: string;
  recipient: string;
  recipientAddress: string;
  recipientConsent?: boolean;
  purpose: string;
  amount: string;
  asset: string;
  network: string;
  txHash: string;
  date: string;
  note: string;
  organizationName?: string;
  status: string;
  verification?: {
    status: string;
    checkedAt: string;
    amount?: string;
    asset?: string;
  };
};

const verificationLabels: Record<string, string> = {
  verified: 'Verified on-chain',
  mismatch: 'Mismatch',
  'not-found': 'Not found',
  unverified: 'Unverified',
  pending: 'Checking',
  voided: 'Voided',
};

const clean = (value: string | undefined, fallback = 'Not provided') =>
  value?.replace(/\s+/g, ' ').trim() || fallback;

export function formatReceipt(record: ReceiptRecord): string {
  const consent = record.recipientConsent === true;
  const verificationStatus = record.status;
  const lines = [
    'AidTrace Receipt',
    `Record ID: ${clean(record.id)}`,
    '',
    'USER-ENTERED RECORD DATA',
    `Network: ${clean(record.network)}`,
    `Beneficiary: ${consent ? clean(record.recipient) : 'Beneficiary (identity withheld)'}`,
    `Purpose: ${clean(record.purpose)}`,
    `Aid amount: ${clean(record.amount)} ${clean(record.asset, '')}`.trim(),
    `Organization: ${clean(record.organizationName, 'Not provided')}`,
    `Record date: ${clean(record.date)}`,
    `Beneficiary wallet: ${consent ? clean(record.recipientAddress) : 'Withheld by consent settings'}`,
    `Transaction hash: ${
      consent ? clean(record.txHash, 'Not supplied') : 'Withheld by consent settings'
    }`,
    `Note: ${consent ? clean(record.note) : 'Withheld by consent settings'}`,
    '',
    'HORIZON-DERIVED VERIFICATION',
    `Verification state: ${verificationLabels[verificationStatus] || 'Unverified'}`,
    `Checked at: ${clean(record.verification?.checkedAt, 'Not checked')}`,
  ];

  if (record.verification?.amount) {
    lines.push(`Horizon amount: ${clean(record.verification.amount)}`);
  }
  if (record.verification?.asset) {
    lines.push(`Horizon asset: ${clean(record.verification.asset)}`);
  }

  lines.push(
    '',
    'Limitation: Horizon verification checks public Stellar transaction fields only. It does not confirm the real-world recipient, receipt, use, or impact of funds.',
  );
  return lines.join('\n');
}
