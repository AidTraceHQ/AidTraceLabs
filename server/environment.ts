import { config } from 'dotenv';

config({ path: ['.env.local', '.env'] });

const requiredKeys = [
  'NODE_ENV',
  'DATABASE_URL',
  'SESSION_SECRET',
  'PUBLIC_APP_ORIGIN',
  'CORS_ALLOWED_ORIGINS',
  'DEFAULT_STELLAR_NETWORK',
  'HORIZON_TESTNET_URL',
  'HORIZON_MAINNET_URL',
] as const;

export function integerEnvironmentVariable(
  name: string,
  defaultValue: number,
  minimum = 1,
  environment: NodeJS.ProcessEnv = process.env,
): number {
  const raw = environment[name];
  const value = raw === undefined || raw.trim() === '' ? defaultValue : Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}.`);
  }
  return value;
}

export function validateEnvironment(environment: NodeJS.ProcessEnv = process.env): void {
  const missing: string[] = [];

  for (const key of requiredKeys) {
    const value = environment[key];
    if (!value || (typeof value === 'string' && value.trim().length === 0)) {
      missing.push(key);
    }
  }

  const sessionSecret = environment.SESSION_SECRET;
  if (sessionSecret && Buffer.byteLength(sessionSecret) < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 bytes.');
  }

  const pseudonymSecret = environment.PSEUDONYM_SECRET;
  if (pseudonymSecret) {
    if (Buffer.byteLength(pseudonymSecret) < 32 || pseudonymSecret.startsWith('replace-with-')) {
      throw new Error('PSEUDONYM_SECRET must contain at least 32 bytes.');
    }
  } else if (environment.NODE_ENV !== 'development') {
    missing.push('PSEUDONYM_SECRET');
  }

  const port = integerEnvironmentVariable('PORT', 3001, 1, environment);
  if (port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  integerEnvironmentVariable('API_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, 1, environment);
  integerEnvironmentVariable('API_RATE_LIMIT_MAX', 120, 1, environment);
  integerEnvironmentVariable('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, 1, environment);
  integerEnvironmentVariable('AUTH_RATE_LIMIT_MAX', 20, 1, environment);
  integerEnvironmentVariable('TRUST_PROXY_HOPS', 0, 0, environment);

  const publicAppOrigin = environment.PUBLIC_APP_ORIGIN;
  if (publicAppOrigin) {
    try {
      new URL(publicAppOrigin);
    } catch {
      throw new Error('PUBLIC_APP_ORIGIN must be a valid URL.');
    }
  }

  const corsAllowedOrigins = environment.CORS_ALLOWED_ORIGINS;
  if (corsAllowedOrigins) {
    const origins = corsAllowedOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    if (origins.length === 0) {
      throw new Error('CORS_ALLOWED_ORIGINS must include at least one allowed origin.');
    }
    for (const origin of origins) {
      try {
        new URL(origin);
      } catch {
        throw new Error('CORS_ALLOWED_ORIGINS contains an invalid origin.');
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}.`);
  }
}

validateEnvironment();
