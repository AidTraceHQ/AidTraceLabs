import { Buffer } from 'buffer';
import { Networks } from '@stellar/stellar-sdk';

export type StellarNetwork = 'testnet' | 'mainnet';
export type ConnectionResult = {
  isConnected: boolean;
  error?: { message: string };
};

const connectionAttempts = 20;
const connectionRetryDelayMs = 250;

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

export async function waitForFreighter(
  check: () => Promise<ConnectionResult>,
  sleep: (milliseconds: number) => Promise<void> = delay,
): Promise<void> {
  let latestError: { message: string } | undefined;
  for (let attempt = 0; attempt < connectionAttempts; attempt += 1) {
    const result = await check();
    if (result.isConnected && !result.error) return;
    latestError = result.error ?? latestError;
    if (attempt + 1 < connectionAttempts) await sleep(connectionRetryDelayMs);
  }
  if (latestError?.message) throw new Error(latestError.message);
  throw new Error('Freighter is not connected. Check that the extension is enabled and try again.');
}

export function throwFreighterError(result: { error?: { message: string } }): void {
  if (result.error) {
    throw new Error(result.error.message || 'Freighter returned an unspecified error.');
  }
}

export function signatureToBase64(signature: Buffer | string | null): string {
  if (Buffer.isBuffer(signature)) {
    if (signature.length !== 64)
      throw new Error('Freighter returned a signature with an invalid length.');
    return signature.toString('base64');
  }
  if (typeof signature !== 'string' || signature.length === 0) {
    throw new Error('Freighter did not return a signed message.');
  }
  if (/^[0-9a-fA-F]{128}$/.test(signature)) {
    return Buffer.from(signature, 'hex').toString('base64');
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) {
    throw new Error('Freighter returned a signature in an unsupported encoding.');
  }
  const decoded = Buffer.from(signature, 'base64');
  if (decoded.length !== 64) {
    throw new Error('Freighter returned a signature in an unsupported encoding.');
  }
  return decoded.toString('base64');
}

export function networkPassphrase(network: StellarNetwork): string {
  return network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC;
}
