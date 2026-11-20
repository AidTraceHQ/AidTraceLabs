import './environment.js';
import { rateLimit } from 'express-rate-limit';
import { integerEnvironmentVariable } from './environment.js';
import {
  auditSecurityRejection,
  type SecurityRejectionEvent,
  type SecurityRejectionScope,
} from './http-security.js';

type SecurityRejectionLogger = (event: SecurityRejectionEvent) => unknown;

export function createIpRateLimiter(
  windowMs: number,
  limit: number,
  scope: SecurityRejectionScope = 'public_read_ip',
  logRejection: SecurityRejectionLogger = auditSecurityRejection,
) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'rate_limit_exceeded' },
    handler: (_request, response, _next, options) => {
      logRejection({ category: 'rate_limit', scope });
      response.status(options.statusCode).json(options.message);
    },
  });
}

export function createApiIpRateLimiter(
  windowMs: number,
  limit: number,
  logRejection: SecurityRejectionLogger = auditSecurityRejection,
) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'rate_limit_exceeded' },
    handler: (_request, response, _next, options) => {
      logRejection({ category: 'rate_limit', scope: 'api_ip' });
      response.status(options.statusCode).json(options.message);
    },
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
  'public_read_ip',
);

export const authIpRateLimit = createIpRateLimiter(
  integerEnvironmentVariable('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  integerEnvironmentVariable('AUTH_RATE_LIMIT_MAX', 20),
  'auth_ip',
);
