import { integerEnvironmentVariable } from './environment.js';
import express, { type ErrorRequestHandler } from 'express';
import { authRouter } from './auth.js';
import { cors } from './http-security.js';
import { apiIpRateLimit, authIpRateLimit, publicReadIpRateLimit } from './rate-limits.js';
import { recordsRouter } from './records.js';
import { databaseUnavailableResponse } from './database-errors.js';

const app = express();

app.disable('x-powered-by');
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
