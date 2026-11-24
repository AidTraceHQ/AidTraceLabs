export const DEFAULT_LOCALE = 'en-US';

export const messageKeys = [
  'recordDetails',
  'beneficiary',
  'purpose',
  'amount',
  'organization',
  'networkAndDate',
  'transaction',
  'noTransactionHash',
  'transactionHidden',
  'created',
  'status',
  'verificationNote',
  'voidReason',
  'beneficiaryWithheld',
  'mismatchDetails',
  'expected',
  'found',
  'copyTransactionHash',
  'viewOnStellarExpert',
  'verifiedOnChain',
  'mismatch',
  'notFound',
  'unverified',
  'checking',
  'voided',
] as const;

export type MessageKey = (typeof messageKeys)[number];
export type MessageCatalog = Partial<Record<MessageKey, string>>;
export type MessageResources = Record<string, MessageCatalog>;

const englishMessages: Record<MessageKey, string> = {
  recordDetails: 'AID RECORD DETAILS',
  beneficiary: 'Beneficiary',
  purpose: 'Purpose',
  amount: 'Amount',
  organization: 'Organization',
  networkAndDate: 'Network and date',
  transaction: 'Transaction',
  noTransactionHash: 'No transaction hash supplied',
  transactionHidden: 'Hidden for beneficiary privacy',
  created: 'Created',
  status: 'Status',
  verificationNote: 'Verification note',
  voidReason: 'Void reason',
  beneficiaryWithheld: 'Pseudonymous by default',
  mismatchDetails: 'Mismatch details',
  expected: 'Expected',
  found: 'Found',
  copyTransactionHash: 'Copy transaction hash',
  viewOnStellarExpert: 'View on Stellar Expert',
  verifiedOnChain: 'Verified on-chain',
  mismatch: 'Mismatch',
  notFound: 'Not found',
  unverified: 'Unverified',
  checking: 'Checking…',
  voided: 'Voided',
};

const messageResources: MessageResources = {
  [DEFAULT_LOCALE]: englishMessages,
};

export function resolveMessage(
  key: MessageKey,
  locale: string,
  resources: MessageResources = messageResources,
): string {
  const exact = resources[locale]?.[key];
  if (exact) return exact;

  const language = locale.split('-')[0];
  const languageMessage = language ? resources[language]?.[key] : undefined;
  return languageMessage || resources[DEFAULT_LOCALE]?.[key] || englishMessages[key];
}

export const getMessage = (key: MessageKey, locale = DEFAULT_LOCALE) => resolveMessage(key, locale);

function supportedLocale(locale: string) {
  return Intl.DateTimeFormat.supportedLocalesOf([locale])[0] || DEFAULT_LOCALE;
}

export function formatDate(value: string, locale = DEFAULT_LOCALE): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(supportedLocale(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatDisplayAmount(value: string, locale = DEFAULT_LOCALE): string {
  const [whole, fraction = ''] = value.split('.');
  const resolvedLocale = supportedLocale(locale);
  const wholeFormatter = new Intl.NumberFormat(resolvedLocale, {
    maximumFractionDigits: 0,
  });
  const digitsFormatter = new Intl.NumberFormat(resolvedLocale, {
    useGrouping: false,
    maximumFractionDigits: 0,
  });
  const decimalSeparator =
    new Intl.NumberFormat(resolvedLocale).formatToParts(1.1).find((part) => part.type === 'decimal')
      ?.value || '.';
  const localizedDigits = Array.from({ length: 10 }, (_, digit) => digitsFormatter.format(digit));
  const localizedFraction = [...fraction]
    .map((digit) => localizedDigits[Number(digit)] ?? digit)
    .join('');

  return (
    wholeFormatter.format(BigInt(whole || '0')) +
    (fraction ? decimalSeparator + localizedFraction : '')
  );
}

export function formatAmount(value: string): string {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole || '0').toLocaleString() + (fraction ? '.' + fraction : '');
}
