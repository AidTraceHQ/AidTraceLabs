import { randomBytes } from 'node:crypto';
import { Router, type Response } from 'express';
import { rateLimit } from './auth.js';
import { pool, withTransaction } from './db.js';
import { noStore } from './http-security.js';
import { notificationConfig } from './notification-config.js';
import {
  DeliveryError,
  encryptField,
  generateSigningSecret,
  hostnameOf,
  parseWebhookUrl,
  resolvePublicTarget,
  sendSignedWebhook,
  decryptField,
} from './notification-security.js';
import {
  endpointFieldContext,
  isNotificationEventType,
  notificationDependencies,
  notificationEventTypes,
} from './notifications.js';
import { authorize } from './records.js';

const router = Router();
const maxEndpointsPerOwner = 5;
const idPattern = /^[a-f0-9]{32}$/;
const deliveryIdPattern = /^dlv_[a-f0-9]{32}$/;

type EndpointRow = {
  id: string;
  owner_wallet: string;
  scope: 'organization' | 'all';
  display_host: string;
  event_types: string[];
  status: 'pending_verification' | 'active' | 'revoked';
  created_at: Date;
  verified_at: Date | null;
  revoked_at: Date | null;
};

const endpointColumns = `id, owner_wallet, scope, display_host, event_types, status, created_at,
  verified_at, revoked_at`;

// The stored URL and secret are never returned: only the host is shown back to the owner.
function publicEndpoint(row: EndpointRow) {
  return {
    id: row.id,
    host: row.display_host,
    scope: row.scope,
    events: row.event_types,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    verifiedAt: row.verified_at?.toISOString(),
    revokedAt: row.revoked_at?.toISOString(),
  };
}

function error(response: Response, status: number, message: string) {
  response.status(status).json({ error: message });
}

function param(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) || '';
}

async function audit(
  action: string,
  actor: string,
  summary: string,
  client: Pick<import('pg').PoolClient, 'query'> = pool,
) {
  await client.query(
    `INSERT INTO audit_events (id, action, actor_wallet, summary) VALUES ($1, $2, $3, $4)`,
    [randomBytes(16).toString('hex'), action, actor, summary],
  );
}

// Disabled or unconfigured: skip the whole router so requests reach the existing 404 handler.
router.use('/api/notifications', (_request, _response, next) => {
  next(notificationConfig().enabled ? undefined : 'router');
});

router.get('/api/notifications/endpoints', noStore, async (request, response) => {
  const current = await authorize(request, response, ['organization', 'admin']);
  if (!current) return;
  const result = await pool.query<EndpointRow>(
    `SELECT ${endpointColumns} FROM notification_endpoints
     WHERE owner_wallet = $1 ORDER BY created_at DESC, id DESC`,
    [current.session.address],
  );
  response.json({ endpoints: result.rows.map(publicEndpoint), eventTypes: notificationEventTypes });
});

router.post('/api/notifications/endpoints', noStore, async (request, response) => {
  const current = await authorize(request, response, ['organization', 'admin'], true);
  if (!current) return;
  const config = notificationConfig();
  if (!config.enabled) return;
  const body = request.body as Record<string, unknown>;
  const url = parseWebhookUrl(body?.url);
  if (!url) {
    error(response, 400, 'Webhook URL must be an absolute HTTPS URL without credentials.');
    return;
  }
  const scope = body?.scope === undefined ? 'organization' : body.scope;
  if (scope !== 'organization' && !(scope === 'all' && current.session.role === 'admin')) {
    error(response, 400, 'Only admins may subscribe to events for all records.');
    return;
  }
  const events = body?.events === undefined ? [...notificationEventTypes] : body.events;
  if (
    !Array.isArray(events) ||
    events.length === 0 ||
    events.length > notificationEventTypes.length ||
    !events.every(isNotificationEventType) ||
    new Set(events).size !== events.length
  ) {
    error(response, 400, 'Events must be a non-empty list of supported event types.');
    return;
  }
  try {
    await resolvePublicTarget(url, notificationDependencies().resolver);
  } catch {
    error(response, 400, 'Webhook URL must resolve only to public internet addresses.');
    return;
  }

  const id = randomBytes(16).toString('hex');
  const signingSecret = generateSigningSecret();
  const created = await withTransaction(async (client) => {
    // Serialize per owner so the endpoint cap holds under concurrent requests.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      'notification-endpoints:' + current.session.address,
    ]);
    const count = await client.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM notification_endpoints
       WHERE owner_wallet = $1 AND status <> 'revoked'`,
      [current.session.address],
    );
    if (Number(count.rows[0]?.total || 0) >= maxEndpointsPerOwner) return null;
    const inserted = await client.query<EndpointRow>(
      `INSERT INTO notification_endpoints
         (id, owner_wallet, scope, url_ciphertext, display_host, secret_ciphertext, event_types,
          status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_verification')
       RETURNING ${endpointColumns}`,
      [
        id,
        current.session.address,
        scope,
        encryptField(config.encryptionKey, url.toString(), endpointFieldContext(id, 'url')),
        hostnameOf(url),
        encryptField(config.encryptionKey, signingSecret, endpointFieldContext(id, 'secret')),
        events,
      ],
    );
    await audit(
      'notification_endpoint_created',
      current.session.address,
      `Registered webhook endpoint ${id} for ${hostnameOf(url)}; awaiting verification.`,
      client,
    );
    return inserted.rows[0]!;
  });
  if (!created) {
    error(response, 409, `At most ${maxEndpointsPerOwner} webhook endpoints are allowed.`);
    return;
  }
  // The signing secret is shown exactly once; only its ciphertext is stored.
  response.status(201).json({ endpoint: publicEndpoint(created), signingSecret });
});

async function ownedEndpoint(
  id: string,
  owner: string,
  allowAdmin: boolean,
  role: string,
): Promise<(EndpointRow & { url_ciphertext: string; secret_ciphertext: string }) | null> {
  if (!idPattern.test(id)) return null;
  const result = await pool.query<
    EndpointRow & { url_ciphertext: string; secret_ciphertext: string }
  >(
    `SELECT ${endpointColumns}, url_ciphertext, secret_ciphertext
     FROM notification_endpoints WHERE id = $1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;
  if (row.owner_wallet === owner || (allowAdmin && role === 'admin')) return row;
  return null;
}

router.post('/api/notifications/endpoints/:id/verify', noStore, async (request, response) => {
  const current = await authorize(request, response, ['organization', 'admin'], true);
  if (!current) return;
  const config = notificationConfig();
  if (!config.enabled) return;
  const endpoint = await ownedEndpoint(
    param(request.params.id),
    current.session.address,
    false,
    current.session.role,
  );
  if (!endpoint) {
    error(response, 404, 'Webhook endpoint not found.');
    return;
  }
  if (endpoint.status !== 'pending_verification') {
    error(response, 409, 'Only endpoints awaiting verification can be verified.');
    return;
  }
  if (!(await rateLimit('notification-verify:' + current.session.address, 10, 60 * 1000))) {
    error(response, 429, 'Verification rate limit reached. Retry in a minute.');
    return;
  }
  let url: URL | null;
  let secret = '';
  try {
    url = parseWebhookUrl(
      decryptField(
        config.encryptionKey,
        endpoint.url_ciphertext,
        endpointFieldContext(endpoint.id, 'url'),
      ),
    );
    secret = decryptField(
      config.encryptionKey,
      endpoint.secret_ciphertext,
      endpointFieldContext(endpoint.id, 'secret'),
    );
  } catch {
    url = null;
  }
  if (!url || !secret) {
    error(response, 422, 'Webhook endpoint could not be read. Register it again.');
    return;
  }

  // Recipient verification: the target must echo a fresh challenge in a 2xx response body.
  const challenge = randomBytes(24).toString('base64url');
  const deliveryId = 'vrf_' + randomBytes(16).toString('hex');
  const body = JSON.stringify({
    id: deliveryId,
    type: 'endpoint.verification',
    createdAt: new Date().toISOString(),
    data: { endpointId: endpoint.id, challenge },
  });
  let failure: string | null = null;
  try {
    const { transport, resolver } = notificationDependencies();
    const result = await sendSignedWebhook({
      url,
      secret,
      deliveryId,
      eventType: 'endpoint.verification',
      body,
      connectTimeoutMs: config.connectTimeoutMs,
      readTimeoutMs: config.readTimeoutMs,
      transport,
      resolver,
    });
    if (result.status < 200 || result.status >= 300) failure = 'http_' + result.status;
    else if (result.body.trim() !== challenge) failure = 'challenge_mismatch';
  } catch (sendError) {
    failure = sendError instanceof DeliveryError ? sendError.code : 'transport_error';
  }
  if (failure) {
    error(response, 422, `Webhook endpoint verification failed (${failure}).`);
    return;
  }

  const updated = await withTransaction(async (client) => {
    const result = await client.query<EndpointRow>(
      `UPDATE notification_endpoints
       SET status = 'active', verified_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'pending_verification'
       RETURNING ${endpointColumns}`,
      [endpoint.id],
    );
    if (result.rowCount === 1) {
      await audit(
        'notification_endpoint_verified',
        current.session.address,
        `Verified webhook endpoint ${endpoint.id}.`,
        client,
      );
    }
    return result.rows[0] ?? null;
  });
  if (!updated) {
    error(response, 409, 'Webhook endpoint changed during verification.');
    return;
  }
  response.json({ endpoint: publicEndpoint(updated) });
});

router.post(
  '/api/notifications/endpoints/:id/rotate-secret',
  noStore,
  async (request, response) => {
    const current = await authorize(request, response, ['organization', 'admin'], true);
    if (!current) return;
    const config = notificationConfig();
    if (!config.enabled) return;
    const endpoint = await ownedEndpoint(
      param(request.params.id),
      current.session.address,
      false,
      current.session.role,
    );
    if (!endpoint || endpoint.status === 'revoked') {
      error(response, 404, 'Webhook endpoint not found.');
      return;
    }
    const signingSecret = generateSigningSecret();
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE notification_endpoints SET secret_ciphertext = $2, updated_at = NOW()
       WHERE id = $1 AND status <> 'revoked'`,
        [
          endpoint.id,
          encryptField(
            config.encryptionKey,
            signingSecret,
            endpointFieldContext(endpoint.id, 'secret'),
          ),
        ],
      );
      await audit(
        'notification_endpoint_secret_rotated',
        current.session.address,
        `Rotated the signing secret for webhook endpoint ${endpoint.id}.`,
        client,
      );
    });
    response.json({ endpoint: publicEndpoint(endpoint), signingSecret });
  },
);

router.delete('/api/notifications/endpoints/:id', noStore, async (request, response) => {
  const current = await authorize(request, response, ['organization', 'admin'], true);
  if (!current) return;
  const endpoint = await ownedEndpoint(
    param(request.params.id),
    current.session.address,
    true,
    current.session.role,
  );
  if (!endpoint) {
    error(response, 404, 'Webhook endpoint not found.');
    return;
  }
  const result = await withTransaction(async (client) => {
    const revoked = await client.query<EndpointRow>(
      `UPDATE notification_endpoints
       SET status = 'revoked', revoked_at = NOW(), revoked_by = $2, updated_at = NOW()
       WHERE id = $1 AND status <> 'revoked'
       RETURNING ${endpointColumns}`,
      [endpoint.id, current.session.address],
    );
    if (revoked.rowCount !== 1) return null;
    const cancelled = await client.query(
      `UPDATE notification_deliveries
       SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = $2,
           last_error = 'endpoint_revoked', updated_at = NOW()
       WHERE endpoint_id = $1 AND status = 'pending'`,
      [endpoint.id, current.session.address],
    );
    await audit(
      'notification_endpoint_revoked',
      current.session.address,
      `Revoked webhook endpoint ${endpoint.id}; cancelled ${cancelled.rowCount ?? 0} pending deliveries.`,
      client,
    );
    return revoked.rows[0]!;
  });
  if (!result) {
    error(response, 409, 'Webhook endpoint is already revoked.');
    return;
  }
  response.json({ endpoint: publicEndpoint(result) });
});

router.get('/api/notifications/deliveries', noStore, async (request, response) => {
  const current = await authorize(request, response, ['organization', 'admin']);
  if (!current) return;
  const endpointId = typeof request.query.endpointId === 'string' ? request.query.endpointId : '';
  const endpoint = await ownedEndpoint(
    endpointId,
    current.session.address,
    false,
    current.session.role,
  );
  if (!endpoint) {
    error(response, 404, 'Webhook endpoint not found.');
    return;
  }
  // Payloads are not returned here; the metadata is enough to track and cancel deliveries.
  const result = await pool.query<{
    id: string;
    event_id: string;
    event_type: string;
    record_id: string | null;
    status: string;
    attempts: number;
    max_attempts: number;
    next_attempt_at: Date;
    last_error: string | null;
    last_status_code: number | null;
    created_at: Date;
    delivered_at: Date | null;
    cancelled_at: Date | null;
  }>(
    `SELECT id, event_id, event_type, record_id, status, attempts, max_attempts, next_attempt_at,
            last_error, last_status_code, created_at, delivered_at, cancelled_at
     FROM notification_deliveries
     WHERE endpoint_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 50`,
    [endpoint.id],
  );
  response.json({
    deliveries: result.rows.map((row) => ({
      id: row.id,
      eventId: row.event_id,
      eventType: row.event_type,
      recordId: row.record_id ?? undefined,
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      nextAttemptAt: row.status === 'pending' ? row.next_attempt_at.toISOString() : undefined,
      lastError: row.last_error ?? undefined,
      lastStatusCode: row.last_status_code ?? undefined,
      createdAt: row.created_at.toISOString(),
      deliveredAt: row.delivered_at?.toISOString(),
      cancelledAt: row.cancelled_at?.toISOString(),
    })),
  });
});

router.post('/api/notifications/deliveries/:id/cancel', noStore, async (request, response) => {
  const current = await authorize(request, response, ['organization', 'admin'], true);
  if (!current) return;
  const deliveryId = param(request.params.id);
  if (!deliveryIdPattern.test(deliveryId)) {
    error(response, 404, 'Delivery not found.');
    return;
  }
  const result = await withTransaction(async (client) => {
    const found = await client.query<{ status: string; owner_wallet: string }>(
      `SELECT d.status, e.owner_wallet
       FROM notification_deliveries d
       JOIN notification_endpoints e ON e.id = d.endpoint_id
       WHERE d.id = $1
       FOR UPDATE OF d`,
      [deliveryId],
    );
    const row = found.rows[0];
    if (
      !row ||
      (row.owner_wallet !== current.session.address && current.session.role !== 'admin')
    ) {
      return 'missing' as const;
    }
    if (row.status !== 'pending') return 'not-pending' as const;
    await client.query(
      `UPDATE notification_deliveries
       SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = $2,
           last_error = 'cancelled_by_user', updated_at = NOW()
       WHERE id = $1 AND status = 'pending'`,
      [deliveryId, current.session.address],
    );
    await audit(
      'notification_delivery_cancelled',
      current.session.address,
      `Cancelled webhook delivery ${deliveryId}.`,
      client,
    );
    return 'cancelled' as const;
  });
  if (result === 'missing') {
    error(response, 404, 'Delivery not found.');
    return;
  }
  if (result === 'not-pending') {
    error(response, 409, 'Only pending deliveries can be cancelled.');
    return;
  }
  response.json({ ok: true, delivery: { id: deliveryId, status: 'cancelled' } });
});

export { router as notificationsRouter };
