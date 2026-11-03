export class DatabaseUnavailableError extends Error {
  constructor(cause: unknown) {
    super('Database unavailable.', { cause });
    this.name = 'DatabaseUnavailableError';
  }
}

const transientCodes = new Set(['EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT']);

function errorCause(error: unknown): unknown {
  return error instanceof Error ? error.cause : undefined;
}

export function isTransientDatabaseError(error: unknown): boolean {
  if (error instanceof DatabaseUnavailableError) return true;
  if (typeof error !== 'object' || error === null) return false;
  if (
    'code' in error &&
    typeof error.code === 'string' &&
    transientCodes.has(error.code)
  ) {
    return true;
  }
  if (
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.includes('Connection terminated unexpectedly')
  ) {
    return true;
  }
  return isTransientDatabaseError(errorCause(error));
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