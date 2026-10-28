import { URL } from 'node:url';

type Network = 'testnet' | 'mainnet';
type AidPayment = {
  network: Network;
  txHash: string;
  organizationWallet: string;
  recipientWallet: string;
  amountStroops: string;
  assetCode: string;
  assetIssuer: string | null;
};

export type Verification = {
  status: 'verified' | 'mismatch' | 'not-found' | 'unverified' | 'pending';
  checkedAt: string;
  differences: string[];
  ledger?: number;
  createdAt?: string;
  sourceAccount?: string;
  destination?: string;
  amount?: string;
  asset?: string;
  assetIssuer?: string;
  link?: string;
  reason?: string;
};

type HorizonTransaction = {
  successful?: boolean;
  ledger?: number;
  created_at?: string;
  source_account?: string;
};

type HorizonOperation = Record<string, unknown> & { paging_token?: string };

const operationPageSize = 200;
const operationPageLimit = 20;
const amountPattern = /^(\d+)(?:\.(\d{1,7}))?$/;

function horizonUrl(network: Network): URL {
  const configured = network === 'mainnet'
    ? process.env.HORIZON_MAINNET_URL || 'https://horizon.stellar.org'
    : process.env.HORIZON_TESTNET_URL || 'https://horizon-testnet.stellar.org';
  const url = new URL(configured);
  if ((url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') ||
      url.username || url.password || url.search || url.hash) {
    throw new Error('Configured Horizon URL must be a trusted HTTP(S) base URL.');
  }
  return new URL(url.toString().replace(/\/+$/, '') + '/');
}

function toStroops(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = amountPattern.exec(value);
  if (!match) return null;
  try {
    return (BigInt(match[1]) * 10_000_000n + BigInt((match[2] || '').padEnd(7, '0') || '0')).toString();
  } catch {
    return null;
  }
}

function amountFromStroops(value: string): string {
  const stroops = BigInt(value);
  const whole = (stroops / 10_000_000n).toString();
  const fraction = (stroops % 10_000_000n).toString().padStart(7, '0').replace(/0+$/, '');
  return fraction ? whole + '.' + fraction : whole;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function operationDestination(operation: HorizonOperation): string {
  const type = text(operation.type);
  return text(operation.to) || text(operation.destination) ||
    (type === 'create_account' ? text(operation.account) : '');
}

function operationAsset(operation: HorizonOperation): { code: string; issuer: string } {
  const type = text(operation.type);
  const assetType = type === 'path_payment_strict_send'
    ? text(operation.destination_asset_type)
    : text(operation.asset_type);
  if (assetType === 'native' || type === 'create_account') return { code: 'XLM', issuer: '' };
  return {
    code: type === 'path_payment_strict_send'
      ? text(operation.destination_asset_code).toUpperCase()
      : text(operation.asset_code).toUpperCase(),
    issuer: type === 'path_payment_strict_send'
      ? text(operation.destination_asset_issuer)
      : text(operation.asset_issuer),
  };
}

function operationAmount(operation: HorizonOperation): string {
  return text(operation.type) === 'create_account'
    ? text(operation.starting_balance)
    : text(operation.type) === 'path_payment_strict_send'
      ? text(operation.destination_amount)
      : text(operation.amount);
}

function operationSource(operation: HorizonOperation, transaction: HorizonTransaction): string {
  return text(operation.from) || text(operation.funder) || text(operation.source_account) ||
    text(transaction.source_account);
}

async function getJson<T>(url: URL): Promise<{ response: Response; data?: T }> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return { response };
  try {
    return { response, data: await response.json() as T };
  } catch {
    return { response };
  }
}

function explorerLink(network: Network, txHash: string): string {
  return (network === 'mainnet'
    ? 'https://stellar.expert/explorer/public/tx/'
    : 'https://stellar.expert/explorer/testnet/tx/') + encodeURIComponent(txHash);
}

export async function checkTransaction(record: AidPayment): Promise<Verification> {
  const checkedAt = new Date().toISOString();
  if (!record.txHash) {
    return { status: 'unverified', checkedAt, differences: [], reason: 'No transaction hash was supplied.' };
  }
  let base: URL;
  try {
    base = horizonUrl(record.network);
  } catch {
    return { status: 'pending', checkedAt, differences: [], reason: 'Horizon is not configured correctly.' };
  }

  const transactionUrl = new URL('transactions/' + encodeURIComponent(record.txHash), base);
  let transactionResponse: Response;
  let transaction: HorizonTransaction | undefined;
  try {
    const result = await getJson<HorizonTransaction>(transactionUrl);
    transactionResponse = result.response;
    transaction = result.data;
  } catch {
    return { status: 'pending', checkedAt, differences: [], reason: 'Horizon is unavailable. Retry verification.' };
  }
  if (transactionResponse.status === 404) {
    return { status: 'not-found', checkedAt, differences: [], reason: 'Hash was not found on the selected network.' };
  }
  if (!transactionResponse.ok || !transaction) {
    return {
      status: 'pending',
      checkedAt,
      differences: [],
      reason: 'Horizon returned an unreadable or unsuccessful transaction response. Retry later.',
    };
  }

  const link = explorerLink(record.network, record.txHash);
  if (transaction.successful === false) {
    return {
      status: 'mismatch',
      checkedAt,
      differences: ['Transaction is marked unsuccessful on Stellar.'],
      ledger: transaction.ledger,
      createdAt: transaction.created_at,
      sourceAccount: transaction.source_account,
      link,
    };
  }
  if (transaction.successful !== true) {
    return { status: 'pending', checkedAt, differences: [], reason: 'Horizon did not confirm transaction success.' };
  }

  const operations: HorizonOperation[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < operationPageLimit; page += 1) {
    const operationsUrl = new URL(
      'transactions/' + encodeURIComponent(record.txHash) + '/operations',
      base,
    );
    operationsUrl.searchParams.set('limit', String(operationPageSize));
    operationsUrl.searchParams.set('order', 'asc');
    if (cursor) operationsUrl.searchParams.set('cursor', cursor);

    let response: Response;
    let pageRecords: HorizonOperation[] | undefined;
    try {
      const result = await getJson<{ _embedded?: { records?: HorizonOperation[] } }>(operationsUrl);
      response = result.response;
      pageRecords = result.data?._embedded?.records;
    } catch {
      return { status: 'pending', checkedAt, differences: [], reason: 'Horizon operations endpoint is unavailable.' };
    }
    if (!response.ok || !pageRecords) {
      return { status: 'pending', checkedAt, differences: [], reason: 'Could not read transaction operations from Horizon.' };
    }
    operations.push(...pageRecords);
    if (pageRecords.length < operationPageSize) break;
    cursor = pageRecords[pageRecords.length - 1]?.paging_token;
    if (!cursor) {
      return { status: 'pending', checkedAt, differences: [], reason: 'Horizon operation pagination was incomplete.' };
    }
    if (page === operationPageLimit - 1) {
      return {
        status: 'pending',
        checkedAt,
        differences: [],
        reason: 'Transaction has more operations than the verification limit.',
      };
    }
  }

  const payments = operations.filter(operation =>
    ['payment', 'create_account', 'path_payment_strict_receive', 'path_payment_strict_send']
      .includes(text(operation.type)),
  );
  const expectedAmount = record.amountStroops;
  const expectedAsset = record.assetCode.toUpperCase();
  const hasExpectedIssuer = expectedAsset === 'XLM' || !!record.assetIssuer;
  const differences: string[] = [];
  let destinationMatch = false;
  let amountMatch = false;
  let assetMatch = false;
  let issuerMatch = false;
  let sourceMatch = false;

  for (const operation of payments) {
    const destination = operationDestination(operation);
    const amount = toStroops(operationAmount(operation));
    const asset = operationAsset(operation);
    const source = operationSource(operation, transaction);
    const matchesDestination = destination === record.recipientWallet;
    const matchesAmount = amount === expectedAmount;
    const matchesAsset = asset.code === expectedAsset;
    const matchesIssuer = expectedAsset === 'XLM' || asset.issuer === record.assetIssuer;
    const matchesSource = source === record.organizationWallet;

    destinationMatch ||= matchesDestination;
    amountMatch ||= matchesAmount;
    assetMatch ||= matchesAsset;
    issuerMatch ||= matchesIssuer;
    sourceMatch ||= matchesSource;

    if (matchesDestination && matchesAmount && matchesAsset && matchesIssuer && matchesSource) {
      return {
        status: 'verified',
        checkedAt,
        differences: [],
        ledger: transaction.ledger,
        createdAt: transaction.created_at,
        sourceAccount: source,
        destination,
        amount: amountFromStroops(expectedAmount),
        asset: asset.code,
        assetIssuer: asset.issuer || undefined,
        link,
      };
    }
  }

  if (!payments.length) differences.push('No payment operation was found in this transaction.');
  else {
    if (!destinationMatch) differences.push('Destination differs from the recorded beneficiary.');
    if (!amountMatch) differences.push('Amount differs from the recorded amount.');
    if (!assetMatch) differences.push('Asset differs from the recorded asset.');
    else if (!issuerMatch) differences.push('Asset issuer differs from the recorded issuer.');
    if (!sourceMatch) differences.push('Payment source differs from the organization wallet.');
    if (!differences.length) differences.push('No single payment operation matches all recorded fields.');
  }
  if (!hasExpectedIssuer) differences.push('A non-native recorded asset requires an issuer.');
  return {
    status: 'mismatch',
    checkedAt,
    differences,
    ledger: transaction.ledger,
    createdAt: transaction.created_at,
    sourceAccount: transaction.source_account,
    link,
  };
}
