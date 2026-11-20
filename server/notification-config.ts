import { createHash } from 'node:crypto';

/**
 * Outbound notification configuration. Delivery is opt-in: unless `NOTIFICATIONS_ENABLED=true`,
 * the notification routes fall through to the API's 404 handler and no notification query runs.
 */
export type NotificationConfig =
  | { enabled: false }
  | {
      enabled: true;
      encryptionKey: Buffer;
      maxAttempts: number;
      connectTimeoutMs: number;
      readTimeoutMs: number;
      retryBaseMs: number;
      retryMaxMs: number;
    };

function boundedInteger(
  environment: NodeJS.ProcessEnv,
  name: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  const raw = environment[name];
  const value = raw === undefined || raw.trim() === '' ? defaultValue : Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

export function parseNotificationConfig(
  environment: NodeJS.ProcessEnv = process.env,
): NotificationConfig {
  const flag = (environment.NOTIFICATIONS_ENABLED || '').trim().toLowerCase();
  if (flag !== '' && flag !== 'true' && flag !== 'false') {
    throw new Error('NOTIFICATIONS_ENABLED must be "true" or "false".');
  }
  if (flag !== 'true') return { enabled: false };

  const rawKey = environment.NOTIFICATIONS_ENCRYPTION_KEY || '';
  if (Buffer.byteLength(rawKey) < 32 || rawKey.startsWith('replace-with-')) {
    throw new Error(
      'NOTIFICATIONS_ENCRYPTION_KEY must contain at least 32 bytes when notifications are enabled.',
    );
  }
  if (rawKey === environment.SESSION_SECRET || rawKey === environment.PSEUDONYM_SECRET) {
    throw new Error(
      'NOTIFICATIONS_ENCRYPTION_KEY must differ from SESSION_SECRET and PSEUDONYM_SECRET.',
    );
  }

  const retryBaseMs = boundedInteger(
    environment,
    'NOTIFICATIONS_RETRY_BASE_MS',
    30_000,
    1_000,
    3_600_000,
  );
  return {
    enabled: true,
    // Derive a fixed-length AES-256 key so operators can supply any high-entropy string.
    encryptionKey: createHash('sha256')
      .update('aidtrace-notifications-v1:')
      .update(rawKey)
      .digest(),
    maxAttempts: boundedInteger(environment, 'NOTIFICATIONS_MAX_ATTEMPTS', 5, 1, 10),
    connectTimeoutMs: boundedInteger(
      environment,
      'NOTIFICATIONS_CONNECT_TIMEOUT_MS',
      5_000,
      100,
      30_000,
    ),
    readTimeoutMs: boundedInteger(
      environment,
      'NOTIFICATIONS_READ_TIMEOUT_MS',
      10_000,
      100,
      60_000,
    ),
    retryBaseMs,
    retryMaxMs: Math.max(retryBaseMs, 60 * 60 * 1000),
  };
}

export function notificationConfig(): NotificationConfig {
  return parseNotificationConfig(process.env);
}
