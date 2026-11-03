import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { pool, withTransaction } from './db.js';
import { noStore, requireAllowedOrigin } from './http-security.js';
import { retryReadOnlyDatabase } from './database-errors.js';

type Network = 'testnet' | 'mainnet';
type Role = 'donor' | 'organization' | 'beneficiary' | 'admin';
type Session = {
  sessionHash: string;
  address: string;
  network: Network;
  role: Role;
  csrfTokenHash: string;
  expiresAt: Date;
};

const router = Router();
const cookieName = 'aidtrace_session';
const challengeTtlMs = 5 * 60 * 1000;
const sessionTtlMs = 7 * 24 * 60 * 60 * 1000;
const sessionSecret = process.env.SESSION_SECRET;
const publicAppOrigin = new URL(process.env.PUBLIC_APP_ORIGIN || 'http://localhost:5173').origin;

if (!sessionSecret || Buffer.byteLength(sessionSecret) < 32) {
  throw new Error('SESSION_SECRET must contain at least 32 bytes.');
}

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const validNetwork = (value: unknown): value is Network =>
  value === 'testnet' || value === 'mainnet';
const validAddress = (value: unknown): value is string =>
  typeof value === 'string' && StrKey.isValidEd25519PublicKey(value);
const makeCsrfToken = (token: string) =>
  createHmac('sha256', sessionSecret).update('aidtrace-csrf:').update(token).digest('base64url');
const makeChallengeMessage = (address: string, network: Network, nonce: string, expiresAt: Date) =>
  'AidTrace wallet login\nDomain: ' +
  publicAppOrigin +
  '\nAddress: ' +
  address +
  '\nNetwork: ' +
  network +
  '\nNonce: ' +
  nonce +
  '\nIssued At: ' +
  new Date(expiresAt.getTime() - challengeTtlMs).toISOString() +
  '\nExpires: ' +
  expiresAt.toISOString() +
  '\nPurpose: prove wallet ownership; no transaction will be sent.';

function requestObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function cookieToken(request: Request): string | null {
  const raw = request.get('Cookie');
  if (!raw) return null;
  const pair = raw
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(cookieName + '='));
  if (!pair) return null;
  try {
    return decodeURIComponent(pair.slice(cookieName.length + 1)) || null;
  } catch {
    return null;
  }
}

function signatureBytes(value: string): Buffer | null {
  if (/^[0-9a-fA-F]{128}$/.test(value)) return Buffer.from(value, 'hex');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  const decoded = Buffer.from(value, 'base64');
  return decoded.length === 64 &&
    decoded.toString('base64').replace(/=+$/, '') === value.replace(/=+$/, '')
    ? decoded
    : null;
}

export function verifySep53Signature(address: string, message: string, signature: string): boolean {
  const signatureBuffer = signatureBytes(signature);
  if (!validAddress(address) || !signatureBuffer) return false;
  const signedDigest = createHash('sha256')
    .update('Stellar Signed Message:\n', 'utf8')
    .update(message, 'utf8')
    .digest();
  return Keypair.fromPublicKey(address).verify(signedDigest, signatureBuffer);
}

function csrfMatches(candidate: unknown, expectedHash: string): boolean {
  if (typeof candidate !== 'string' || candidate.length > 200) return false;
  const candidateHash = Buffer.from(digest(candidate), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return candidateHash.length === expected.length && timingSafeEqual(candidateHash, expected);
}

async function getSession(
  request: Request,
): Promise<{ session: Session; token: string; csrfToken: string } | null> {
  const token = cookieToken(request);
  if (!token || token.length < 40) return null;
  const sessionHash = digest(token);
  const result = await pool.query<{
    address: string;
    network: Network;
    role: Role | null;
    csrf_token_hash: string;
    expires_at: Date;
  }>(
    `SELECT s.wallet_address AS address, s.network, r.role, s.csrf_token_hash, s.expires_at
     FROM sessions s
     LEFT JOIN wallet_roles r ON r.wallet_address = s.wallet_address
     WHERE s.session_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()`,
    [sessionHash],
  );
  const row = result.rows[0];
  if (!row) return null;
  const session: Session = {
    sessionHash,
    address: row.address,
    network: row.network,
    role: row.role || 'donor',
    csrfTokenHash: row.csrf_token_hash,
    expiresAt: row.expires_at,
  };
  return { session, token, csrfToken: makeCsrfToken(token) };
}

function setSessionCookie(response: Response, token: string) {
  response.cookie(cookieName, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: sessionTtlMs,
  });
}

function clearSessionCookie(response: Response) {
  response.setHeader(
    'Set-Cookie',
    `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=${new Date(0).toUTCString()}`,
  );
}

async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs);
  const keyHash = digest(key);
  const result = await pool.query(
    `INSERT INTO rate_limits (key_hash, window_start, request_count, expires_at)
     VALUES ($1, $2, 1, $3)
     ON CONFLICT (key_hash, window_start)
     DO UPDATE SET request_count = rate_limits.request_count + 1
     WHERE rate_limits.request_count < $4
     RETURNING request_count`,
    [keyHash, windowStart, expiresAt, max],
  );
  return result.rowCount === 1;
}

async function audit(action: string, actor: string, summary: string) {
  await pool.query(
    `INSERT INTO audit_events (id, action, actor_wallet, summary)
     VALUES ($1, $2, $3, $4)`,
    [randomBytes(16).toString('hex'), action, actor, summary],
  );
}

router.post('/api/auth/challenge', noStore, async (request, response) => {
  if (!requireAllowedOrigin(request, response)) return;
  const body = requestObject(request.body);
  const address = body?.address;
  const network = body?.network;
  if (!validAddress(address) || !validNetwork(network)) {
    response
      .status(400)
      .json({ error: 'A valid Stellar public address and network are required.' });
    return;
  }
  if (!(await rateLimit('challenge:' + address, 8, 15 * 60 * 1000))) {
    response.status(429).json({ error: 'Too many challenges. Wait a few minutes and try again.' });
    return;
  }

  const challengeId = randomBytes(24).toString('hex');
  const nonce = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + challengeTtlMs);
  const message = makeChallengeMessage(address, network, nonce, expiresAt);
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO users (wallet_address) VALUES ($1)
       ON CONFLICT (wallet_address) DO NOTHING`,
      [address],
    );
    await client.query(
      `INSERT INTO challenges (challenge_id, nonce, wallet_address, network, signed_message, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [challengeId, nonce, address, network, message, expiresAt],
    );
  });
  response.status(200).json({ challengeId, message, expiresAt: expiresAt.getTime() });
});

router.post('/api/auth/verify', noStore, async (request, response) => {
  if (!requireAllowedOrigin(request, response)) return;
  const body = requestObject(request.body);
  const challengeId = body?.challengeId;
  const address = body?.address;
  const network = body?.network;
  const signature = body?.signature;
  if (
    typeof challengeId !== 'string' ||
    !/^[a-f0-9]{48}$/.test(challengeId) ||
    !validAddress(address) ||
    !validNetwork(network) ||
    typeof signature !== 'string' ||
    signature.length > 1000
  ) {
    response.status(400).json({ error: 'Invalid signature verification request.' });
    return;
  }
  if (!(await rateLimit('verify:' + address, 12, 60 * 1000))) {
    response.status(429).json({ error: 'Too many signature attempts. Wait a minute and retry.' });
    return;
  }
  const challengeResult = await pool.query<{
    wallet_address: string;
    network: Network;
    signed_message: string;
    expires_at: Date;
    used_at: Date | null;
  }>(
    `SELECT wallet_address, network, signed_message, expires_at, used_at
     FROM challenges WHERE challenge_id = $1`,
    [challengeId],
  );
  const challenge = challengeResult.rows[0];
  if (!challenge) {
    response.status(401).json({ error: 'Challenge not found. Request a fresh challenge.' });
    return;
  }
  if (challenge.expires_at.getTime() <= Date.now()) {
    response.status(401).json({ error: 'Challenge expired. Request a fresh challenge.' });
    return;
  }
  if (challenge.used_at) {
    response
      .status(409)
      .json({ error: 'Challenge was already used. Connect again for a new challenge.' });
    return;
  }
  if (challenge.wallet_address !== address || challenge.network !== network) {
    response.status(401).json({ error: 'Wallet or network does not match the challenge.' });
    return;
  }
  if (!verifySep53Signature(address, challenge.signed_message, signature)) {
    response.status(401).json({ error: 'Signature verification failed. No session was created.' });
    return;
  }

  const token = randomBytes(32).toString('base64url');
  const tokenHash = digest(token);
  const csrfToken = makeCsrfToken(token);
  const csrfTokenHash = digest(csrfToken);
  const expiresAt = new Date(Date.now() + sessionTtlMs);
  let role: Role = 'donor';
  const consumeOutcome = await withTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE challenges SET used_at = NOW()
       WHERE challenge_id = $1 AND used_at IS NULL AND expires_at > NOW()
       RETURNING challenge_id`,
      [challengeId],
    );
    if (updated.rowCount !== 1) {
      const refreshed = await client.query<{ used_at: Date | null; expires_at: Date }>(
        'SELECT used_at, expires_at FROM challenges WHERE challenge_id = $1',
        [challengeId],
      );
      const challengeState = refreshed.rows[0];
      if (challengeState?.used_at) return 'used' as const;
      if (challengeState && challengeState.expires_at.getTime() <= Date.now())
        return 'expired' as const;
      return 'invalid' as const;
    }
    await client.query(
      `INSERT INTO users (wallet_address, last_authenticated_at)
       VALUES ($1, NOW())
       ON CONFLICT (wallet_address)
       DO UPDATE SET last_authenticated_at = EXCLUDED.last_authenticated_at`,
      [address],
    );
    const roleResult = await client.query<{ role: Role }>(
      'SELECT role FROM wallet_roles WHERE wallet_address = $1',
      [address],
    );
    role = roleResult.rows[0]?.role || 'donor';
    await client.query(
      `INSERT INTO sessions (session_hash, wallet_address, network, csrf_token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [tokenHash, address, network, csrfTokenHash, expiresAt],
    );
    await client.query(
      `INSERT INTO audit_events (id, action, actor_wallet, summary)
       VALUES ($1, 'wallet_authenticated', $2, $3)`,
      [randomBytes(16).toString('hex'), address, 'Wallet ownership verified on ' + network],
    );
    return 'consumed' as const;
  });
  if (consumeOutcome === 'used') {
    response
      .status(409)
      .json({ error: 'Challenge was already used. Connect again for a new challenge.' });
    return;
  }
  if (consumeOutcome === 'expired') {
    response.status(401).json({ error: 'Challenge expired. Request a fresh challenge.' });
    return;
  }
  if (consumeOutcome === 'invalid') {
    response
      .status(401)
      .json({ error: 'Challenge expired or already used. Request a fresh challenge.' });
    return;
  }
  setSessionCookie(response, token);
  response.status(200).json({
    session: { address, network, role, csrfToken, expiresAt: expiresAt.toISOString() },
  });
});

router.get('/api/me', noStore, (request, response) =>
  retryReadOnlyDatabase('/api/me', async () => {
  const current = await getSession(request);
  if (!current) {
    clearSessionCookie(response);
    response.status(200).json({ session: null });
    return;
  }
  response.status(200).json({
    session: {
      address: current.session.address,
      network: current.session.network,
      role: current.session.role,
      csrfToken: current.csrfToken,
      expiresAt: current.session.expiresAt.toISOString(),
    },
  });
  }),
);

router.post('/api/auth/logout', noStore, async (request, response) => {
  if (!requireAllowedOrigin(request, response)) return;
  const current = await getSession(request);
  if (current && !csrfMatches(request.body?.csrfToken, current.session.csrfTokenHash)) {
    response.status(403).json({ error: 'CSRF check failed. Refresh the app and retry.' });
    return;
  }
  if (current) {
    await withTransaction(async (client) => {
      await client.query(
        'UPDATE sessions SET revoked_at = NOW() WHERE session_hash = $1 AND revoked_at IS NULL',
        [current.session.sessionHash],
      );
      await client.query(
        `INSERT INTO audit_events (id, action, actor_wallet, summary)
         VALUES ($1, 'wallet_logged_out', $2, 'Wallet session revoked.')`,
        [randomBytes(16).toString('hex'), current.session.address],
      );
    });
  }
  clearSessionCookie(response);
  response.status(200).json({ ok: true });
});

router.post('/api/auth/logout-everywhere', noStore, async (request, response) => {
  if (!requireAllowedOrigin(request, response)) return;
  const current = await getSession(request);
  if (!current) {
    response.status(401).json({ error: 'Session expired. Reconnect Freighter.' });
    return;
  }
  if (!csrfMatches(request.body?.csrfToken, current.session.csrfTokenHash)) {
    response.status(403).json({ error: 'CSRF check failed. Refresh the app and retry.' });
    return;
  }
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE sessions SET revoked_at = NOW()
       WHERE wallet_address = $1 AND revoked_at IS NULL`,
      [current.session.address],
    );
    await client.query(
      `INSERT INTO audit_events (id, action, actor_wallet, summary)
       VALUES ($1, 'wallet_logout_everywhere', $2, 'Revoked all active sessions for this wallet.')`,
      [randomBytes(16).toString('hex'), current.session.address],
    );
  });
  clearSessionCookie(response);
  response.status(200).json({ ok: true });
});

export { router as authRouter, getSession, rateLimit, audit, csrfMatches };
