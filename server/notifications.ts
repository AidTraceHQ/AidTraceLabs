import { randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from './db.js';
import { notificationConfig } from './notification-config.js';
import {
  classifyStatus,
  decryptField,
  DeliveryError,
  httpsTransport,
  MAX_REDIRECTS,
  parseWebhookUrl,
  retryDelayMs,
  sendSignedWebhook,
  systemResolver,
  type Resolver,
  type Transport,
} from './notification-security.js';

export const notificationEventTypes = [
  'record.created',
  'record.updated',
  'record.voided',
  'record.verification_changed',
] as const;
export type NotificationEventType = (typeof notificationEventTypes)[number];

export function isNotificationEventType(value: unknown): value is NotificationEventType {
  return (notificationEventTypes as readonly unknown[]).includes(value);
}

// Injected transport and resolver. Tests replace both so nothing leaves the process.
let transport: Transport = httpsTransport;
let resolver: Resolver = systemResolver;

export function setNotificationDependencies(dependencies: {
  transport?: Transport;
  resolver?: Resolver;
}): void {
  if (dependencies.transport) transport = dependencies.transport;
  if (dependencies.resolver) resolver = dependencies.resolver;
}

export function resetNotificationDependencies(): void {
  transport = httpsTransport;
  resolver = systemResolver;
}

export function notificationDependencies(): { transport: Transport; resolver: Resolver } {
  return { transport, resolver };
}

export const endpointFieldContext = (endpointId: string, field: 'url' | 'secret') =>
  `aidtrace-notification-endpoint:${endpointId}:${field}`;

type Queryable = Pick<PoolClient, 'query'>;

export type RecordEventSource = {
  id: string;
  network: string;
  status: string;
  version: number;
  // Any other column passed in is deliberately ignored.
  [column: string]: unknown;
};

export type RecordEventPayload = {
  id: string;
  type: NotificationEventType;
  createdAt: string;
  data: {
    recordId: string;
    network: string;
    status: string;
    previousStatus?: string;
    version: number;
  };
};

/**
 * Builds the event body from an explicit allowlist. Beneficiary names, wallet addresses, notes,
 * purposes, amounts and transaction hashes are never copied; receivers fetch details through the
 * authenticated API, which applies its normal role and consent checks.
 */
export function buildRecordEventPayload(input: {
  eventId: string;
  type: NotificationEventType;
  record: RecordEventSource;
  previousStatus?: string | null;
  occurredAt?: Date;
}): RecordEventPayload {
  return {
    id: input.eventId,
    type: input.type,
    createdAt: (input.occurredAt ?? new Date()).toISOString(),
    data: {
      recordId: String(input.record.id),
      network: String(input.record.network),
      status: String(input.record.status),
      ...(input.previousStatus ? { previousStatus: String(input.previousStatus) } : {}),
      version: Number(input.record.version),
    },
  };
}

/**
 * Locks the record row and returns its status before a verification write, so a later
 * `enqueueStatusChange` can tell whether the status flipped. Returns null without querying when
 * notifications are disabled.
 */
export async function lockRecordStatus(client: Queryable, recordId: string) {
  if (!notificationConfig().enabled) return null;
  const result = await client.query<{ status: string }>(
    'SELECT status FROM aid_records WHERE id = $1 FOR UPDATE',
    [recordId],
  );
  return result.rows[0]?.status ?? null;
}

/**
 * Transactional outbox: inserts one pending delivery per active, verified endpoint that is still
 * authorized for the record. Runs inside the caller's transaction and is a no-op (no query) when
 * notifications are disabled.
 */
export async function enqueueRecordEvent(
  client: Queryable,
  type: NotificationEventType,
  recordId: string,
  previousStatus?: string | null,
): Promise<void> {
  const config = notificationConfig();
  if (!config.enabled) return;
  const recordResult = await client.query<{
    id: string;
    organization_wallet: string;
    network: string;
    status: string;
    version: number;
  }>('SELECT id, organization_wallet, network, status, version FROM aid_records WHERE id = $1', [
    recordId,
  ]);
  const record = recordResult.rows[0];
  if (!record) return;
  const eventId = 'evt_' + randomBytes(16).toString('hex');
  const payload = buildRecordEventPayload({ eventId, type, record, previousStatus });
  await client.query(
    `INSERT INTO notification_deliveries
       (id, endpoint_id, event_id, event_type, record_id, payload_json, status, max_attempts)
     SELECT 'dlv_' || substr(encode(sha256(convert_to(e.id || ':' || $1, 'UTF8')), 'hex'), 1, 32),
            e.id, $1, $2, $3, $4::jsonb, 'pending', $5
     FROM notification_endpoints e
     JOIN wallet_roles r ON r.wallet_address = e.owner_wallet
     WHERE e.status = 'active'
       AND $2 = ANY(e.event_types)
       AND ((e.scope = 'organization' AND e.owner_wallet = $6
             AND r.role IN ('organization', 'admin'))
         OR (e.scope = 'all' AND r.role = 'admin'))
     ON CONFLICT (endpoint_id, event_id) DO NOTHING`,
    [
      eventId,
      type,
      record.id,
      JSON.stringify(payload),
      config.maxAttempts,
      record.organization_wallet,
    ],
  );
}

/** Enqueues `record.verification_changed` only when the status actually differs. */
export async function enqueueStatusChange(
  client: Queryable,
  recordId: string,
  previousStatus: string | null,
): Promise<void> {
  if (previousStatus === null || !notificationConfig().enabled) return;
  const current = await client.query<{ status: string }>(
    'SELECT status FROM aid_records WHERE id = $1',
    [recordId],
  );
  const status = current.rows[0]?.status;
  if (!status || status === previousStatus) return;
  await enqueueRecordEvent(client, 'record.verification_changed', recordId, previousStatus);
}

export type DeliverySummary = {
  claimed: number;
  delivered: number;
  retried: number;
  failed: number;
  cancelled: number;
};

type ClaimedDelivery = {
  id: string;
  endpoint_id: string;
  event_type: string;
  payload_json: unknown;
  attempts: number;
  max_attempts: number;
};

async function finalize(
  delivery: ClaimedDelivery,
  claimToken: string,
  outcome:
    | { status: 'delivered'; statusCode: number }
    | { status: 'pending'; error: string; statusCode?: number; retryInMs: number }
    | { status: 'failed' | 'cancelled'; error: string; statusCode?: number },
): Promise<void> {
  await pool.query(
    `UPDATE notification_deliveries
     SET status = $3,
         last_error = $4,
         last_status_code = $5,
         next_attempt_at = CASE WHEN $3 = 'pending'
                                THEN NOW() + ($6::bigint * INTERVAL '1 millisecond')
                                ELSE next_attempt_at END,
         delivered_at = CASE WHEN $3 = 'delivered' THEN NOW() ELSE delivered_at END,
         cancelled_at = CASE WHEN $3 = 'cancelled' THEN NOW() ELSE cancelled_at END,
         claim_token = NULL,
         lease_expires_at = NULL,
         updated_at = NOW()
     WHERE id = $1 AND claim_token = $2 AND status = 'delivering'`,
    [
      delivery.id,
      claimToken,
      outcome.status,
      'error' in outcome ? outcome.error : null,
      outcome.statusCode ?? null,
      outcome.status === 'pending' ? outcome.retryInMs : 0,
    ],
  );
}

/**
 * Claims due deliveries with SKIP LOCKED, sends each once, and records the outcome. A delivery
 * is attempted at most `max_attempts` times; a lease lets a crashed worker's claims be retried.
 * Only stable error codes are stored or returned; URLs, secrets and payloads are never logged.
 */
export async function processDueDeliveries(
  options: { limit?: number } = {},
): Promise<DeliverySummary> {
  const summary: DeliverySummary = {
    claimed: 0,
    delivered: 0,
    retried: 0,
    failed: 0,
    cancelled: 0,
  };
  const config = notificationConfig();
  if (!config.enabled) return summary;
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const claimToken = randomBytes(16).toString('hex');
  const leaseMs = (config.connectTimeoutMs + config.readTimeoutMs) * (MAX_REDIRECTS + 1) + 30_000;
  const claimed = await pool.query<ClaimedDelivery>(
    `UPDATE notification_deliveries d
     SET status = 'delivering', attempts = d.attempts + 1, claim_token = $1,
         lease_expires_at = NOW() + ($3::bigint * INTERVAL '1 millisecond'), updated_at = NOW()
     WHERE d.id IN (
       SELECT id FROM notification_deliveries
       WHERE (status = 'pending' AND next_attempt_at <= NOW())
          OR (status = 'delivering' AND lease_expires_at < NOW())
       ORDER BY next_attempt_at, id
       LIMIT $2
       FOR UPDATE SKIP LOCKED
     )
     RETURNING d.id, d.endpoint_id, d.event_type, d.payload_json, d.attempts, d.max_attempts`,
    [claimToken, limit, leaseMs],
  );
  summary.claimed = claimed.rowCount ?? claimed.rows.length;

  for (const delivery of claimed.rows) {
    if (delivery.attempts > delivery.max_attempts) {
      await finalize(delivery, claimToken, { status: 'failed', error: 'attempts_exhausted' });
      summary.failed += 1;
      continue;
    }
    const endpointResult = await pool.query<{
      status: string;
      scope: string;
      url_ciphertext: string;
      secret_ciphertext: string;
      role: string | null;
    }>(
      `SELECT e.status, e.scope, e.url_ciphertext, e.secret_ciphertext, r.role
       FROM notification_endpoints e
       LEFT JOIN wallet_roles r ON r.wallet_address = e.owner_wallet
       WHERE e.id = $1`,
      [delivery.endpoint_id],
    );
    const endpoint = endpointResult.rows[0];
    const ownerAuthorized =
      endpoint &&
      (endpoint.scope === 'all'
        ? endpoint.role === 'admin'
        : endpoint.role === 'organization' || endpoint.role === 'admin');
    if (!endpoint || endpoint.status !== 'active' || !ownerAuthorized) {
      await finalize(delivery, claimToken, { status: 'cancelled', error: 'endpoint_inactive' });
      summary.cancelled += 1;
      continue;
    }

    let url: URL | null;
    let secret: string;
    try {
      url = parseWebhookUrl(
        decryptField(
          config.encryptionKey,
          endpoint.url_ciphertext,
          endpointFieldContext(delivery.endpoint_id, 'url'),
        ),
      );
      secret = decryptField(
        config.encryptionKey,
        endpoint.secret_ciphertext,
        endpointFieldContext(delivery.endpoint_id, 'secret'),
      );
    } catch {
      url = null;
      secret = '';
    }
    if (!url || !secret) {
      await finalize(delivery, claimToken, { status: 'failed', error: 'endpoint_unreadable' });
      summary.failed += 1;
      continue;
    }

    let errorCode: string;
    let statusCode: number | undefined;
    let retryable: boolean;
    try {
      const response = await sendSignedWebhook({
        url,
        secret,
        deliveryId: delivery.id,
        eventType: delivery.event_type,
        body: JSON.stringify(delivery.payload_json),
        connectTimeoutMs: config.connectTimeoutMs,
        readTimeoutMs: config.readTimeoutMs,
        transport,
        resolver,
      });
      const classification = classifyStatus(response.status);
      if (classification === 'delivered') {
        await finalize(delivery, claimToken, { status: 'delivered', statusCode: response.status });
        summary.delivered += 1;
        continue;
      }
      errorCode = 'http_' + response.status;
      statusCode = response.status;
      retryable = classification === 'retry';
    } catch (sendError) {
      if (sendError instanceof DeliveryError) {
        errorCode = sendError.code;
        statusCode = sendError.statusCode;
        retryable = sendError.retryable;
      } else {
        errorCode = 'transport_error';
        retryable = true;
      }
    }

    if (retryable && delivery.attempts < delivery.max_attempts) {
      await finalize(delivery, claimToken, {
        status: 'pending',
        error: errorCode,
        statusCode,
        retryInMs: retryDelayMs(delivery.attempts, config.retryBaseMs, config.retryMaxMs),
      });
      summary.retried += 1;
    } else {
      await finalize(delivery, claimToken, { status: 'failed', error: errorCode, statusCode });
      summary.failed += 1;
    }
  }
  return summary;
}
