import './environment.js';
import express, { type ErrorRequestHandler } from 'express';
import { authRouter } from './auth.js';
import { cors } from './http-security.js';
import { recordsRouter } from './records.js';

const app = express();

app.disable('x-powered-by');
app.use(cors);
app.use(express.json({ limit: '32kb', strict: true }));
app.use(authRouter);
app.use(recordsRouter);

app.get('/api/_healthcheck', (_request, response) => {
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
  if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
    response.status(413).json({ error: 'Request body is too large.' });
    return;
  }
  console.error('Unhandled API error:', error);
  response.status(500).json({ error: 'Internal server error.' });
};

app.use(errorHandler);

export { app };
