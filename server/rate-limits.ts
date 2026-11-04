import './environment.js';
import { rateLimit } from 'express-rate-limit';
import { integerEnvironmentVariable } from './environment.js';

export function createIpRateLimiter(windowMs: number, limit: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'rate_limit_exceeded' },
  });
}

export function createApiIpRateLimiter(windowMs: number, limit: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'rate_limit_exceeded' },
    skip: (request) =>
      request.method === 'GET' &&
      (request.path === '/transparency' || request.path === '/_healthcheck'),
  });
}

export const apiIpRateLimit = createApiIpRateLimiter(
  integerEnvironmentVariable('API_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  integerEnvironmentVariable('API_RATE_LIMIT_MAX', 120),
);

export const publicReadIpRateLimit = createIpRateLimiter(
  integerEnvironmentVariable('PUBLIC_READ_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  integerEnvironmentVariable('PUBLIC_READ_RATE_LIMIT_MAX', 600),
);

export const authIpRateLimit = createIpRateLimiter(
  integerEnvironmentVariable('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  integerEnvironmentVariable('AUTH_RATE_LIMIT_MAX', 20),
);
