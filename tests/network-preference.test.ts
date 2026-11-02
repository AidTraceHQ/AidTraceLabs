import { describe, expect, it, vi } from 'vitest';
import { readNetworkPreference, writeNetworkPreference } from '../src/network-preference.js';

describe('stored Stellar network preference', () => {
  it('defaults to Testnet and accepts only supported stored networks', () => {
    const storage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    };
    expect(readNetworkPreference(storage)).toBe('testnet');
    storage.getItem.mockReturnValue('mainnet');
    expect(readNetworkPreference(storage)).toBe('mainnet');
    storage.getItem.mockReturnValue('unknown');
    expect(readNetworkPreference(storage)).toBe('testnet');
  });

  it('survives unavailable browser storage and persists a valid choice when possible', () => {
    const unavailable = {
      getItem: () => {
        throw new Error('storage disabled');
      },
      setItem: () => {
        throw new Error('storage disabled');
      },
    };
    expect(readNetworkPreference(unavailable)).toBe('testnet');
    expect(() => writeNetworkPreference('mainnet', unavailable)).not.toThrow();

    const storage = { getItem: vi.fn(), setItem: vi.fn() };
    writeNetworkPreference('mainnet', storage);
    expect(storage.setItem).toHaveBeenCalledWith('aidtrace.network', 'mainnet');
  });
});
