export type StellarNetwork = 'testnet' | 'mainnet';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const storageKey = 'aidtrace.network';

function isStellarNetwork(value: string | null): value is StellarNetwork {
  return value === 'testnet' || value === 'mainnet';
}

export function readNetworkPreference(storage?: StorageLike): StellarNetwork {
  try {
    const stored = (storage ?? window.localStorage).getItem(storageKey);
    return isStellarNetwork(stored) ? stored : 'testnet';
  } catch {
    return 'testnet';
  }
}

export function writeNetworkPreference(network: StellarNetwork, storage?: StorageLike): void {
  try {
    (storage ?? window.localStorage).setItem(storageKey, network);
  } catch {
    // Keep the in-memory selection when browser storage is unavailable.
  }
}
