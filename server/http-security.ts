import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { StrKey } from '@stellar/stellar-sdk';
import { pool } from './db.js';

export type SecurityRejectionCategory =
  | 'failed_signature'
  | 'invalid_challenge'
  | 'expired_challenge'
  | 'replayed_challenge'
  | 'csrf_denial'
  | 'origin_denial'
  | 'authorization_denial'
  | 'rate_limit';

export type SecurityRejectionScope =
  | 'api_ip'
  | 'auth_ip'
  | 'public_read_ip'
  | 'challenge_wallet'
  | 'verify_wallet'
  | 'session_write'
  | 'record_verify_wallet';

export type SecurityRejectionEvent = {
  category: SecurityRejectionCategory;
  actorWallet?: string;
  scope?: SecurityRejectionScope;
};

const categories = new Set<SecurityRejectionCategory>([
  'failed_signature',
  'invalid_challenge',
  'expired_challenge',
  'replayed_challenge',
  'csrf_denial',
  'origin_denial',
  'authorization_denial',
  'rate_limit',
]);
const scopes = new Set<SecurityRejectionScope>([
  'api_ip',
  'auth_ip',
  'public_read_ip',
  'challenge_wallet',
  'verify_wallet',
  'session_write',
  'record_verify_wallet',
]);
const rejectionWriteLimit = 10;
const rejectionWriteWindowMs = 60 * 1000;

export function createSecurityRejectionAuditor(
  write: (event: SecurityRejectionEvent) => Promise<unknown>,
  maxEventsPerWindow = rejectionWriteLimit,
  windowMs = rejectionWriteWindowMs,
  now: () => number = Date.now,
) {
  if (!Number.isInteger(maxEventsPerWindow) || maxEventsPerWindow < 1 || windowMs < 1) {
    throw new Error('Security audit rate-limit settings must be positive.');
  }
  const buckets = new Map<string, { windowStart: number; count: number }>();

  return (input: SecurityRejectionEvent): boolean => {
    if (!categories.has(input.category)) return false;
    if (
      (input.category === 'rate_limit' && (!input.scope || !scopes.has(input.scope))) ||
      (input.category !== 'rate_limit' && input.scope !== undefined)
    ) {
      return false;
    }

    const bucketKey =
      input.category === 'rate_limit' ? input.category + ':' + input.scope : input.category;
    const windowStart = Math.floor(now() / windowMs) * windowMs;
    const bucket = buckets.get(bucketKey);
    if (bucket?.windowStart === windowStart && bucket.count >= maxEventsPerWindow) return false;
    buckets.set(bucketKey, {
      windowStart,
      count: bucket?.windowStart === windowStart ? bucket.count + 1 : 1,
    });

    const event: SecurityRejectionEvent = {
      category: input.category,
      ...(input.scope ? { scope: input.scope } : {}),
      ...(input.actorWallet && StrKey.isValidEd25519PublicKey(input.actorWallet)
        ? { actorWallet: input.actorWallet }
        : {}),
    };
    void Promise.resolve()
      .then(() => write(event))
      .catch(() => {
        console.error('Security rejection audit write failed.');
      });
    return true;
  };
}

async function writeSecurityRejection(event: SecurityRejectionEvent) {
  const metadata = {
    category: event.category,
    ...(event.scope ? { scope: event.scope } : {}),
  };
  const summary =
    'Security rejection: ' + event.category + (event.scope ? ' (' + event.scope + ')' : '');
  await pool.query(
    `INSERT INTO audit_events (id, action, actor_wallet, summary, metadata_json)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      randomBytes(16).toString('hex'),
      'security_' + event.category,
      event.actorWallet || null,
      summary,
      JSON.stringify(metadata),
    ],
  );
}

export const auditSecurityRejection = createSecurityRejectionAuditor(writeSecurityRejection);

const publicOrigin = process.env.PUBLIC_APP_ORIGIN || 'http://localhost:5173';
const allowedOrigins = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || publicOrigin)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

export function isAllowedOrigin(origin: string | undefined): origin is string {
  return !!origin && allowedOrigins.has(origin);
}

export function requireAllowedOrigin(
  request: Request,
  response: Response,
  logRejection: typeof auditSecurityRejection = auditSecurityRejection,
): boolean {
  if (isAllowedOrigin(request.get('Origin'))) return true;
  logRejection({ category: 'origin_denial' });
  response
    .status(403)
    .set('Cache-Control', 'no-store')
    .json({ error: 'Cross-origin request rejected.' });
  return false;
}

export function cors(request: Request, response: Response, next: NextFunction) {
  const origin = request.get('Origin');
  if (origin) {
    if (!isAllowedOrigin(origin)) {
      auditSecurityRejection({ category: 'origin_denial' });
      response.status(403).json({ error: 'Cross-origin request rejected.' });
      return;
    }
    response.set('Access-Control-Allow-Origin', origin);
    response.set('Access-Control-Allow-Credentials', 'true');
    response.vary('Origin');
    response.set('Access-Control-Expose-Headers', 'X-Next-Cursor, X-Has-More, Link');
  }

  if (request.method === 'OPTIONS') {
    response.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.set('Access-Control-Allow-Headers', 'Content-Type');
    response.status(204).end();
    return;
  }

  next();
}

export function noStore(_request: Request, response: Response, next: NextFunction) {
  response.set('Cache-Control', 'no-store');
  next();
}
