export type StellarNetwork = 'testnet' | 'mainnet';

export type HorizonEndpoints = Record<StellarNetwork, string>;

export const DEFAULT_HORIZON_ENDPOINTS: HorizonEndpoints = {
  testnet: 'https://horizon-testnet.stellar.org',
  mainnet: 'https://horizon.stellar.org',
};

export const HORIZON_ENDPOINT_ENV = {
  testnet: 'VITE_HORIZON_TESTNET_URL',
  mainnet: 'VITE_HORIZON_MAINNET_URL',
} as const;

export type HorizonEnvironment = {
  VITE_HORIZON_TESTNET_URL?: string;
  VITE_HORIZON_MAINNET_URL?: string;
};

export type ActivityRequestUrls = {
  account: string;
  payments: string;
  transactions: string;
  stream: string;
};

function readViteEnvironment(): HorizonEnvironment {
  try {
    return (import.meta.env ?? {}) as HorizonEnvironment;
  } catch {
    return {};
  }
}

function normalizeEndpoint(value: string, name: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(name + ' must be an absolute HTTPS URL.');
  }
  if (url.protocol !== 'https:') {
    throw new Error(name + ' must use HTTPS.');
  }
  if (url.username || url.password) {
    throw new Error(name + ' must not include credentials.');
  }
  if (url.search || url.hash) {
    throw new Error(name + ' must be a base URL without a query or fragment.');
  }
  return url.toString().replace(/\/$/, '');
}

export function resolveHorizonEndpoints(
  environment: HorizonEnvironment = readViteEnvironment(),
): HorizonEndpoints {
  return {
    testnet: normalizeEndpoint(
      environment.VITE_HORIZON_TESTNET_URL?.trim() || DEFAULT_HORIZON_ENDPOINTS.testnet,
      HORIZON_ENDPOINT_ENV.testnet,
    ),
    mainnet: normalizeEndpoint(
      environment.VITE_HORIZON_MAINNET_URL?.trim() || DEFAULT_HORIZON_ENDPOINTS.mainnet,
      HORIZON_ENDPOINT_ENV.mainnet,
    ),
  };
}

export function activityRequestUrls(endpoint: string, address: string): ActivityRequestUrls {
  const base = endpoint.replace(/\/$/, '') + '/accounts/' + encodeURIComponent(address);
  return {
    account: base,
    payments: base + '/payments?order=desc&limit=50',
    transactions: base + '/transactions?order=desc&limit=50&include_failed=true',
    stream: base + '/payments?cursor=now',
  };
}
