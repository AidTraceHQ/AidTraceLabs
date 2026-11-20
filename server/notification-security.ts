import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { lookup } from 'node:dns/promises';
import https from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';
import type { TLSSocket } from 'node:tls';

// ---------------------------------------------------------------------------
// Secret storage
// ---------------------------------------------------------------------------

/** AES-256-GCM with the row id and field name as associated data, so ciphertexts cannot be swapped. */
export function encryptField(key: Buffer, plaintext: string, context: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(context, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), ciphertext]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join('.');
}

export function decryptField(key: Buffer, sealed: string, context: string): string {
  const [version, iv, tag, ciphertext] = sealed.split('.');
  if (version !== 'v1' || !iv || !tag || ciphertext === undefined) {
    throw new Error('Unsupported encrypted field format.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(context, 'utf8'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function generateSigningSecret(): string {
  return 'whsec_' + randomBytes(32).toString('base64url');
}

// ---------------------------------------------------------------------------
// Signing and receiver-side verification
// ---------------------------------------------------------------------------

export const SIGNATURE_HEADER = 'aidtrace-signature';
export const DELIVERY_HEADER = 'aidtrace-delivery';
export const EVENT_HEADER = 'aidtrace-event';
export const DEFAULT_SIGNATURE_TOLERANCE_SECONDS = 300;

function signatureDigest(secret: string, timestamp: number, deliveryId: string, body: string) {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${deliveryId}.`, 'utf8')
    .update(body, 'utf8')
    .digest();
}

/** Returns the `AidTrace-Signature` header value: `t=<unix seconds>,v1=<hex HMAC-SHA256>`. */
export function signWebhook(
  secret: string,
  deliveryId: string,
  timestamp: number,
  body: string,
): string {
  return `t=${timestamp},v1=${signatureDigest(secret, timestamp, deliveryId, body).toString('hex')}`;
}

/** Records delivery ids a receiver has already accepted. `remember` returns false for a replay. */
export type ReplayStore = { remember(deliveryId: string, expiresAtMs: number): boolean };

export function createMemoryReplayStore(now: () => number = Date.now): ReplayStore {
  const seen = new Map<string, number>();
  return {
    remember(deliveryId, expiresAtMs) {
      const current = now();
      for (const [id, expiry] of seen) if (expiry <= current) seen.delete(id);
      if (seen.has(deliveryId)) return false;
      seen.set(deliveryId, expiresAtMs);
      return true;
    },
  };
}

export type SignatureCheck =
  { ok: true } | { ok: false; reason: 'malformed' | 'stale' | 'mismatch' | 'replayed' };

/**
 * Reference receiver check. Order matters: the replay store is only written after the signature
 * and timestamp are valid, so unauthenticated requests cannot poison it.
 */
export function verifyWebhookSignature(input: {
  secret: string;
  signatureHeader: string | undefined;
  deliveryId: string | undefined;
  body: string;
  replayStore: ReplayStore;
  nowMs?: number;
  toleranceSeconds?: number;
}): SignatureCheck {
  const nowMs = input.nowMs ?? Date.now();
  const tolerance = input.toleranceSeconds ?? DEFAULT_SIGNATURE_TOLERANCE_SECONDS;
  const match = /^t=(\d{1,12}),v1=([0-9a-f]{64})$/.exec(input.signatureHeader || '');
  if (!match || !input.deliveryId || !/^[A-Za-z0-9_-]{1,100}$/.test(input.deliveryId)) {
    return { ok: false, reason: 'malformed' };
  }
  const timestamp = Number(match[1]);
  if (Math.abs(nowMs / 1000 - timestamp) > tolerance) return { ok: false, reason: 'stale' };
  const expected = signatureDigest(input.secret, timestamp, input.deliveryId, input.body);
  const supplied = Buffer.from(match[2]!, 'hex');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return { ok: false, reason: 'mismatch' };
  }
  // Keep the id at least as long as a timestamp could still be accepted.
  const expiresAtMs = (timestamp + tolerance) * 1000 + 1000;
  if (!input.replayStore.remember(input.deliveryId, expiresAtMs)) {
    return { ok: false, reason: 'replayed' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// SSRF guard
// ---------------------------------------------------------------------------

const blockedIpv4 = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, including 169.254.169.254 cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.88.99.0', 24], // 6to4 relay anycast
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved and broadcast
] as const) {
  blockedIpv4.addSubnet(network, prefix, 'ipv4');
}

// IPv6 targets must be global unicast (2000::/3) and outside the special-purpose ranges below.
// This rejects ::1, ::, IPv4-mapped/compatible forms, fc00::/7 unique-local (including the
// fd00:ec2::254 metadata address), fe80::/10 link-local and ff00::/8 multicast.
const globalUnicastIpv6 = new BlockList();
globalUnicastIpv6.addSubnet('2000::', 3, 'ipv6');
const blockedIpv6 = new BlockList();
for (const [network, prefix] of [
  ['2001::', 23], // IETF protocol assignments, including Teredo
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4, which embeds arbitrary IPv4 addresses
] as const) {
  blockedIpv6.addSubnet(network, prefix, 'ipv6');
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedIpv4.check(address, 'ipv4');
  if (family === 6) {
    return globalUnicastIpv6.check(address, 'ipv6') && !blockedIpv6.check(address, 'ipv6');
  }
  return false;
}

export const MAX_WEBHOOK_URL_LENGTH = 2048;

/** Accepts only absolute HTTPS URLs without embedded credentials. */
export function parseWebhookUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_WEBHOOK_URL_LENGTH) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) return null;
  url.hash = '';
  return url;
}

export function hostnameOf(url: URL): string {
  return url.hostname.replace(/^\[(.*)\]$/, '$1');
}

export type ResolvedAddress = { address: string; family: 4 | 6 };
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

export const systemResolver: Resolver = async (hostname) => {
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map((entry) => ({ address: entry.address, family: entry.family === 6 ? 6 : 4 }));
};

export class DeliveryError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    readonly statusCode?: number,
  ) {
    // The message is the code only: it never carries a URL, header, payload or secret.
    super(code);
    this.name = 'DeliveryError';
  }
}

/**
 * Resolves the target and requires every returned address to be public. The first address is
 * pinned for the connection, so a second DNS answer cannot redirect the request (DNS rebinding).
 */
export async function resolvePublicTarget(url: URL, resolver: Resolver): Promise<ResolvedAddress> {
  const host = hostnameOf(url);
  const literal = isIP(host);
  let addresses: ResolvedAddress[];
  if (literal) {
    addresses = [{ address: host, family: literal === 6 ? 6 : 4 }];
  } else {
    try {
      addresses = await resolver(host);
    } catch {
      throw new DeliveryError('dns_failed', true);
    }
  }
  if (addresses.length === 0) throw new DeliveryError('dns_failed', true);
  if (!addresses.every((entry) => isPublicAddress(entry.address))) {
    throw new DeliveryError('blocked_address', false);
  }
  return addresses[0]!;
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

export type TransportRequest = {
  url: URL;
  address: ResolvedAddress;
  headers: Record<string, string>;
  body: string;
  connectTimeoutMs: number;
  readTimeoutMs: number;
};
export type TransportResponse = { status: number; location?: string; body: string };
export type Transport = (request: TransportRequest) => Promise<TransportResponse>;

const maxResponseBytes = 1024;

/**
 * HTTPS transport pinned to the pre-validated address. The connect timeout covers TCP and TLS
 * setup; the read timeout covers the time from an established connection to the end of the
 * response. Redirects are returned, not followed, so the caller can re-validate the next hop.
 */
export const httpsTransport: Transport = (request) =>
  new Promise<TransportResponse>((resolve, reject) => {
    const host = hostnameOf(request.url);
    const pinnedLookup = ((_hostname, options, callback) => {
      const done = callback as (...args: unknown[]) => void;
      if ((options as { all?: boolean }).all) {
        done(null, [{ address: request.address.address, family: request.address.family }]);
      } else {
        done(null, request.address.address, request.address.family);
      }
    }) as LookupFunction;
    let readTimer: NodeJS.Timeout | undefined;
    let settled = false;
    const finish = (error: DeliveryError | null, response?: TransportResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimer);
      clearTimeout(readTimer);
      if (error) reject(error);
      else resolve(response!);
    };

    const outgoing = https.request({
      host,
      port: request.url.port ? Number(request.url.port) : 443,
      path: request.url.pathname + request.url.search,
      method: 'POST',
      headers: { ...request.headers, 'content-length': String(Buffer.byteLength(request.body)) },
      agent: false,
      lookup: pinnedLookup,
      servername: isIP(host) ? undefined : host,
    });

    // Declared after `finish`, which only runs from asynchronous callbacks registered below.
    const connectTimer = setTimeout(() => {
      outgoing.destroy();
      finish(new DeliveryError('connect_timeout', true));
    }, request.connectTimeoutMs);

    outgoing.on('socket', (socket) => {
      (socket as TLSSocket).once('secureConnect', () => {
        clearTimeout(connectTimer);
        readTimer = setTimeout(() => {
          outgoing.destroy();
          finish(new DeliveryError('read_timeout', true));
        }, request.readTimeoutMs);
      });
    });

    outgoing.on('response', (incoming) => {
      const chunks: Buffer[] = [];
      let size = 0;
      incoming.on('data', (chunk: Buffer) => {
        if (size >= maxResponseBytes) return;
        chunks.push(chunk.subarray(0, maxResponseBytes - size));
        size += chunk.length;
      });
      incoming.on('end', () => {
        const location = incoming.headers.location;
        finish(null, {
          status: incoming.statusCode || 0,
          location: typeof location === 'string' ? location : undefined,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
      incoming.on('error', () => finish(new DeliveryError('connection_error', true)));
    });
    // Driver errors can include addresses or TLS details; report only a stable code.
    outgoing.on('error', () => finish(new DeliveryError('connection_error', true)));
    outgoing.end(request.body);
  });

export const MAX_REDIRECTS = 3;

export function classifyStatus(status: number): 'delivered' | 'retry' | 'fail' {
  if (status >= 200 && status < 300) return 'delivered';
  if (status === 408 || status === 425 || status === 429 || status >= 500) return 'retry';
  return 'fail';
}

/**
 * Sends one signed POST. Every hop, including each 307/308 redirect, is re-validated and
 * re-resolved before any bytes are sent. Other 3xx responses are not followed.
 */
export async function sendSignedWebhook(input: {
  url: URL;
  secret: string;
  deliveryId: string;
  eventType: string;
  body: string;
  connectTimeoutMs: number;
  readTimeoutMs: number;
  transport: Transport;
  resolver: Resolver;
  nowMs?: () => number;
}): Promise<TransportResponse> {
  let url = input.url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const address = await resolvePublicTarget(url, input.resolver);
    const timestamp = Math.floor((input.nowMs?.() ?? Date.now()) / 1000);
    const response = await input.transport({
      url,
      address,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'AidTrace-Webhooks/1',
        [DELIVERY_HEADER]: input.deliveryId,
        [EVENT_HEADER]: input.eventType,
        [SIGNATURE_HEADER]: signWebhook(input.secret, input.deliveryId, timestamp, input.body),
      },
      body: input.body,
      connectTimeoutMs: input.connectTimeoutMs,
      readTimeoutMs: input.readTimeoutMs,
    });
    if (response.status !== 307 && response.status !== 308) return response;
    let next: URL | null;
    try {
      next = response.location ? parseWebhookUrl(new URL(response.location, url).toString()) : null;
    } catch {
      next = null;
    }
    if (!next) throw new DeliveryError('redirect_rejected', false, response.status);
    url = next;
  }
  throw new DeliveryError('redirect_limit', false);
}

/** Exponential backoff with jitter, capped. `attempt` is the attempt that just failed (1-based). */
export function retryDelayMs(
  attempt: number,
  baseMs: number,
  maxMs: number,
  random: () => number = Math.random,
): number {
  const exponential = Math.min(maxMs, baseMs * 2 ** Math.min(Math.max(attempt - 1, 0), 20));
  return Math.round(exponential / 2 + (exponential / 2) * random());
}
