export class DatabaseUnavailableError extends Error {
  constructor(cause: unknown) {
    super('Database unavailable.', { cause });
    this.name = 'DatabaseUnavailableError';
  }
}

// Node.js socket/DNS error codes that indicate a transient connectivity problem.
const transientSocketCodes = new Set([
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
]);

// PostgreSQL SQLSTATEs outside class 08 that are transient: admin_shutdown, too_many_connections.
const transientSqlStates = new Set(['57P01', '53300']);

const sqlStatePattern = /^[0-9A-Z]{5}$/;
const connectionExceptionClass = '08';

// protocol_violation usually signals a client/server bug, not a transient blip, so it is not retried.
const nonTransientConnectionSqlStates = new Set(['08P01']);

// Upper bound on how many nested `cause` levels are inspected; also stops cyclic chains.
const maxCauseDepth = 8;

function errorCause(error: unknown): unknown {
  return error instanceof Error ? error.cause : undefined;
}

function isTransientCode(code: string): boolean {
  if (transientSocketCodes.has(code) || transientSqlStates.has(code)) return true;
  return (
    sqlStatePattern.test(code) &&
    code.startsWith(connectionExceptionClass) &&
    !nonTransientConnectionSqlStates.has(code)
  );
}

export function isTransientDatabaseError(error: unknown): boolean {
  const visited = new Set<object>();
  let current = error;
  for (let depth = 0; depth <= maxCauseDepth; depth += 1) {
    if (current instanceof DatabaseUnavailableError) return true;
    if (typeof current !== 'object' || current === null) return false;
    if (visited.has(current)) return false;
    visited.add(current);
    if ('code' in current && typeof current.code === 'string' && isTransientCode(current.code)) {
      return true;
    }
    if (
      'message' in current &&
      typeof current.message === 'string' &&
      current.message.includes('Connection terminated unexpectedly')
    ) {
      return true;
    }
    current = errorCause(current);
  }
  return false;
}

function errorClass(error: unknown): string {
  if (error instanceof DatabaseUnavailableError) return errorClass(error.cause);
  if (error instanceof Error) return error.constructor.name;
  return typeof error;
}

function logDatabaseFailure(method: string, route: string, error: unknown): void {
  console.error(`Database failure ${method} ${route} (${errorClass(error)})`);
}

export async function retryReadOnlyDatabase<T>(
  route: string,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isTransientDatabaseError(error)) throw error;
    logDatabaseFailure('GET', route, error);
    try {
      return await operation();
    } catch (retryError) {
      if (!isTransientDatabaseError(retryError)) throw retryError;
      throw new DatabaseUnavailableError(retryError);
    }
  }
}

export function databaseUnavailableResponse(
  error: unknown,
  method: string,
  route: string,
): { status: 503; body: { error: 'database_unavailable' } } | null {
  if (!isTransientDatabaseError(error)) return null;
  logDatabaseFailure(method, route, error);
  return { status: 503, body: { error: 'database_unavailable' } };
}

// Upper bound for one readiness probe. Kept below common orchestrator probe timeouts so a hung
// database is reported as not ready by the API rather than as a probe timeout.
export const databaseReadinessTimeoutMs = 2_000;

export class DatabaseReadinessTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Database readiness probe exceeded ${timeoutMs}ms.`);
    this.name = 'DatabaseReadinessTimeoutError';
  }
}

export type DatabaseReadiness =
  { ready: true } | { ready: false; reason: 'timeout' | 'unavailable' | 'error' };

// Runs `probe` with its own deadline and classifies the outcome. Never rethrows, and the result
// carries no driver error text, so callers can return it to unauthenticated clients.
export async function checkDatabaseReadiness(
  probe: () => Promise<unknown>,
  timeoutMs: number = databaseReadinessTimeoutMs,
): Promise<DatabaseReadiness> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new DatabaseReadinessTimeoutError(timeoutMs)), timeoutMs);
  });
  try {
    await Promise.race([probe(), deadline]);
    return { ready: true };
  } catch (error) {
    const reason =
      error instanceof DatabaseReadinessTimeoutError
        ? 'timeout'
        : isTransientDatabaseError(error)
          ? 'unavailable'
          : 'error';
    console.error(`Database readiness check failed (${reason}, ${errorClass(error)})`);
    return { ready: false, reason };
  } finally {
    clearTimeout(timer);
  }
}
