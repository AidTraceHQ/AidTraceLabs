import { integerEnvironmentVariable } from './environment.js';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import { authRouter } from './auth.js';
import { cors } from './http-security.js';
import { apiIpRateLimit, authIpRateLimit, publicReadIpRateLimit } from './rate-limits.js';
import { recordsRouter } from './records.js';
import { databaseUnavailableResponse } from './database-errors.js';

// Per-request completion log. Only method, matched route pattern, status and
// duration are emitted: never the raw URL/query, headers, cookies or bodies.
const requestLogger: RequestHandler = (request, response, next) => {
  const startedAt = process.hrtime.bigint();
  const method = request.method;
  response.once('finish', () => {
    const route = request.route?.path;
    const path = typeof route === 'string' ? request.baseUrl + route : '(unmatched)';
    if (path === '/api/_healthcheck') return;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.info(
      `API request completed: ${method} ${path} ${response.statusCode} ${durationMs.toFixed(1)}ms`,
    );
  });
  next();
};

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', integerEnvironmentVariable('TRUST_PROXY_HOPS', 0, 0));
app.use(requestLogger);
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

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
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
    response.status(unavailable.status).json(unavailable.body);
    return;
  }
  console.error('Unhandled API error:', error);
  const isDevelopment = process.env.NODE_ENV !== 'production';
  response.status(500).json({
    error: 'Internal server error.',
    ...(isDevelopment && error instanceof Error ? { details: error.message } : {}),
  });
};

app.use(errorHandler);

export { app };
