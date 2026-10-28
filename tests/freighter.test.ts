import { Buffer } from 'buffer';
import { Networks } from '@stellar/stellar-sdk';
import { describe, expect, it, vi } from 'vitest';
import {
  networkPassphrase,
  signatureToBase64,
  throwFreighterError,
  waitForFreighter,
} from '../src/freighter.js';

describe('Freighter result handling', () => {
  it('retries disconnected responses until the extension content script is ready', async () => {
    const check = vi.fn()
      .mockResolvedValueOnce({ isConnected: false })
      .mockResolvedValueOnce({ isConnected: false })
      .mockResolvedValueOnce({ isConnected: true });
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(waitForFreighter(check, sleep)).resolves.toBeUndefined();
    expect(check).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('reports the library error after retrying unavailable connection results', async () => {
    const check = vi.fn().mockResolvedValue({
      isConnected: false,
      error: { code: 1, message: 'Freighter content script is unavailable.' },
    });

    await expect(waitForFreighter(check, async () => undefined))
      .rejects.toThrow('Freighter content script is unavailable.');
  });

  it('surfaces errors from each Freighter API response unchanged', () => {
    expect(() => throwFreighterError({
      error: { message: 'User rejected the request.' },
    })).toThrow('User rejected the request.');
  });

  it('normalizes Buffer and string signature responses to base64', () => {
    const bytes = Buffer.alloc(64, 7);
    const encoded = bytes.toString('base64');

    expect(signatureToBase64(bytes)).toBe(encoded);
    expect(signatureToBase64(encoded)).toBe(encoded);
    expect(signatureToBase64(bytes.toString('hex'))).toBe(encoded);
    expect(() => signatureToBase64(null)).toThrow('Freighter did not return a signed message.');
  });

  it('uses the passphrase for the selected Stellar network', () => {
    expect(networkPassphrase('testnet')).toBe(Networks.TESTNET);
    expect(networkPassphrase('mainnet')).toBe(Networks.PUBLIC);
  });
});
