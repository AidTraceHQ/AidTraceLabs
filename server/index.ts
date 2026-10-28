import 'dotenv/config';
import express, { type ErrorRequestHandler } from 'express';
import { pool } from './db.js';
import { authRouter } from './auth.js';
import { cors } from './http-security.js';

const app = express();
const port = Number(process.env.PORT || 3001);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

app.disable('x-powered-by');
app.use(cors);
app.use(express.json({ limit: '32kb', strict: true }));
app.use(authRouter);

app.get('/api/_healthcheck', (_request, response) => {
  response.set('Cache-Control', 'no-store').json({ ok: true, service: 'aidtrace-wallet-api' });
});

app.use((_request, response) => {
  response.status(404).json({ error: 'Route not found.' });
});

const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ error: 'Malformed JSON request body.' });
    return;
  }
  if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
    response.status(413).json({ error: 'Request body is too large.' });
    return;
  }
  console.error('Unhandled API error:', error);
  response.status(500).json({ error: 'Internal server error.' });
};

app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`AidTrace API listening on port ${port}.`);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}; shutting down.`);
  server.close(async error => {
    try {
      await pool.end();
    } catch (poolError) {
      console.error('Failed to close database pool:', poolError);
      process.exitCode = 1;
    }
    if (error) {
      console.error('Failed to close HTTP server:', error);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
