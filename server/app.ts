import { integerEnvironmentVariable } from './environment.js';
import express, { type ErrorRequestHandler } from 'express';
import { authRouter } from './auth.js';
import { cors, requestContext } from './http-security.js';
import { apiIpRateLimit, authIpRateLimit, publicReadIpRateLimit } from './rate-limits.js';
import { recordsRouter } from './records.js';
import { databaseUnavailableResponse } from './database-errors.js';

const app = express();

app.disable('x-powered-by');
app.use(requestContext);
app.set('trust proxy', integerEnvironmentVariable('TRUST_PROXY_HOPS', 0, 0));
app.use(cors);
app.use('/api', apiIpRateLimit);
app.use('/api/auth', authIpRateLimit);
app.use(express.json({ limit: '32kb', strict: true }));
app.use(authRouter);
app.use(recordsRouter);

app.get('/api/_healthcheck', publicReadIpRateLimit, (_request, response) => {
  response.set('Cache-Control', 'no-store').json({ ok: true, service: 'aidtrace-wallet-api' });
});

app.use((_request, response) => {
  response.status(404).json({ error: 'Route not found.' });
});

function routeTemplate(request: Parameters<ErrorRequestHandler>[1]): string {
  const routePath = request.route?.path;
  if (typeof routePath === 'string') return `${request.baseUrl}${routePath}` || routePath;
  return request.baseUrl || 'unmatched';
}

function safeErrorCategory(error: unknown): string {
  if (error instanceof SyntaxError) return 'syntax_error';
  if (error instanceof TypeError) return 'type_error';
  if (error instanceof RangeError) return 'range_error';
  return 'internal_error';
}

function logApiError(
  request: Parameters<ErrorRequestHandler>[1],
  status: number,
  error: unknown,
): void {
  console.error(
    JSON.stringify({
      method: request.method,
      route: routeTemplate(request),
      status,
      requestId: request.requestId,
      errorCategory: safeErrorCategory(error),
    }),
  );
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    (error.type === 'charset.unsupported' || error.type === 'encoding.unsupported')
  ) {
    response.status(415).json({ error: 'Unsupported request encoding.' });
    return;
  }
  if (error instanceof SyntaxError && 'body' in error) {
    const charset = (_request.get('content-type') ?? '')
      .match(/;\s*charset\s*=\s*("?)([^";\s]+)\1/i)?.[2]
      ?.toLowerCase();
    if (charset && charset !== 'utf-8') {
      response.status(415).json({ error: 'Unsupported request encoding.' });
      return;
    }
    response.status(400).json({ error: 'Malformed JSON request body.' });
    return;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.too.large'
  ) {
    response.status(413).json({ error: 'Request body is too large.' });
    return;
  }
  const unavailable = databaseUnavailableResponse(error, _request.method, _request.path);
  if (unavailable) {
    logApiError(_request, unavailable.status, error);
    response.status(unavailable.status).json(unavailable.body);
    return;
  }
  logApiError(_request, 500, error);
  const isDevelopment = process.env.NODE_ENV !== 'production';
  response.status(500).json({
    error: 'Internal server error.',
    ...(isDevelopment && error instanceof Error ? { details: error.message } : {}),
  });
};

app.use(errorHandler);

export { app };
