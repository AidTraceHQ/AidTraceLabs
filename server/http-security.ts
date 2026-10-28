import type { NextFunction, Request, Response } from 'express';

const publicOrigin = process.env.PUBLIC_APP_ORIGIN || 'http://localhost:5173';
const allowedOrigins = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || publicOrigin)
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
);

export function isAllowedOrigin(origin: string | undefined): origin is string {
  return !!origin && allowedOrigins.has(origin);
}

export function requireAllowedOrigin(request: Request, response: Response): boolean {
  if (isAllowedOrigin(request.get('Origin'))) return true;
  response.status(403).set('Cache-Control', 'no-store').json({ error: 'Cross-origin request rejected.' });
  return false;
}

export function cors(request: Request, response: Response, next: NextFunction) {
  const origin = request.get('Origin');
  if (origin) {
    if (!isAllowedOrigin(origin)) {
      response.status(403).json({ error: 'Cross-origin request rejected.' });
      return;
    }
    response.set('Access-Control-Allow-Origin', origin);
    response.set('Access-Control-Allow-Credentials', 'true');
    response.vary('Origin');
    response.set('Access-Control-Expose-Headers', 'X-Next-Cursor, X-Has-More, Link');
  }

  if (request.method === 'OPTIONS') {
    response.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.set('Access-Control-Allow-Headers', 'Content-Type');
    response.status(204).end();
    return;
  }

  next();
}

export function noStore(_request: Request, response: Response, next: NextFunction) {
  response.set('Cache-Control', 'no-store');
  next();
}
