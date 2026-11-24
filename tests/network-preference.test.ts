import { describe, expect, it, vi } from 'vitest';
import {
  describeNetworkEnvironment,
  readNetworkPreference,
  writeNetworkPreference,
} from '../src/network-preference.js';

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

describe('network environment indicator', () => {
  it('labels testnet and states that activity is not real aid disbursement', () => {
    const environment = describeNetworkEnvironment('testnet');

    expect(environment.isTestnet).toBe(true);
    expect(environment.label).toBe('Testnet');
    expect(environment.label.trim()).not.toBe('');
    expect(environment.message).toMatch(/not real aid disbursement/i);
  });

  it('transitions between testnet and mainnet labels in both directions', () => {
    const testnet = describeNetworkEnvironment('testnet');
    const mainnet = describeNetworkEnvironment('mainnet');

    expect(mainnet.isTestnet).toBe(false);
    expect(mainnet.label).toBe('Mainnet');
    expect(mainnet.label.trim()).not.toBe('');
    expect(mainnet.message).not.toMatch(/testnet|not real aid/i);
    expect(mainnet).not.toEqual(testnet);

    expect(describeNetworkEnvironment('testnet')).toEqual(testnet);
    expect(describeNetworkEnvironment('mainnet')).toEqual(mainnet);
  });

  it('derives the indicator without changing record data', () => {
    const record = Object.freeze({
      id: 'record-1',
      recipient: 'Ada',
      amount: '125',
      asset: 'USDC',
      network: 'testnet' as const,
      status: 'verified' as const,
    });
    const snapshot = structuredClone(record);

    const testnet = describeNetworkEnvironment('testnet');
    const mainnet = describeNetworkEnvironment('mainnet');

    expect(record).toEqual(snapshot);
    const indicatorText = JSON.stringify([testnet, mainnet]);
    expect(indicatorText).not.toContain(record.id);
    expect(indicatorText).not.toContain(record.recipient);
    expect(indicatorText).not.toContain(record.amount);
  });
});
