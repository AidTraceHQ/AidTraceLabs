import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../scripts/smoke-remote.js';

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

async function startMock(handler: Handler): Promise<{ close: () => Promise<void>; url: string }> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Mock server did not bind to a TCP port.');
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

function healthyHandler(request: IncomingMessage, response: ServerResponse): void {
  if (request.url === '/api/_healthcheck') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"ok":true,"service":"aidtrace-wallet-api"}');
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html' });
  response.end('<html>FRONTEND_BODY_MUST_NOT_LEAK</html>');
}

function handlerWithHealthBody(body: string): Handler {
  return (request, response) => {
    if (request.url === '/api/_healthcheck') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(body);
      return;
    }
    healthyHandler(request, response);
  };
}

describe('remote smoke command', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('succeeds for a healthy origin and prints only statuses', async () => {
    const mock = await startMock(healthyHandler);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(main([mock.url])).resolves.toBe(0);
      expect(log).toHaveBeenCalledOnce();
      const output = String(log.mock.calls[0][0]);
      expect(output).toBe('liveness: ok\nreadiness: ok\nhealth: true');
      expect(output).not.toContain('FRONTEND_BODY_MUST_NOT_LEAK');
      expect(output).not.toContain('aidtrace-wallet-api');
      expect(output).not.toContain(mock.url);
    } finally {
      await mock.close();
    }
  });

  it('exits non-zero with a concise status when the frontend is not 200', async () => {
    const mock = await startMock((request, response) => {
      if (request.url === '/api/_healthcheck') {
        healthyHandler(request, response);
        return;
      }
      response.writeHead(503);
      response.end('UNAVAILABLE_BODY_MUST_NOT_LEAK');
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(main([mock.url])).resolves.toBe(1);
      expect(String(log.mock.calls[0][0])).toBe('liveness: 503\nreadiness: ok\nhealth: true');
    } finally {
      await mock.close();
    }
  });

  it('exits non-zero for malformed health JSON', async () => {
    const mock = await startMock(handlerWithHealthBody('{"ok":'));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(main([mock.url])).resolves.toBe(1);
      expect(String(log.mock.calls[0][0])).toBe('liveness: ok\nreadiness: invalid\nhealth: false');
    } finally {
      await mock.close();
    }
  });

  it('exits non-zero when the health boolean is false', async () => {
    const mock = await startMock(handlerWithHealthBody('{"ok":false}'));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(main([mock.url])).resolves.toBe(1);
      expect(String(log.mock.calls[0][0])).toBe(
        'liveness: ok\nreadiness: not-ready\nhealth: false',
      );
    } finally {
      await mock.close();
    }
  });

  it('exits non-zero when the health endpoint is not 200', async () => {
    const mock = await startMock((request, response) => {
      if (request.url === '/api/_healthcheck') {
        response.writeHead(500);
        response.end('{"ok":true}');
        return;
      }
      healthyHandler(request, response);
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(main([mock.url])).resolves.toBe(1);
      expect(String(log.mock.calls[0][0])).toBe('liveness: ok\nreadiness: 500\nhealth: false');
    } finally {
      await mock.close();
    }
  });

  it('bounds a stalled origin with a timeout status', async () => {
    const mock = await startMock(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const started = Date.now();
      await expect(main([mock.url], 25)).resolves.toBe(1);
      expect(Date.now() - started).toBeLessThan(2_000);
      expect(String(log.mock.calls[0][0])).toBe(
        'liveness: timeout\nreadiness: timeout\nhealth: false',
      );
    } finally {
      await mock.close();
    }
  });

  it('rejects a missing base URL with status-only output', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(main([])).resolves.toBe(1);
    expect(String(error.mock.calls[0][0])).toBe(
      'liveness: invalid\nreadiness: invalid\nhealth: false',
    );
  });

  it('never echoes an invalid base URL', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(main(['ftp://SECRET_HOST_VALUE.example'])).resolves.toBe(1);
    expect(String(error.mock.calls[0][0])).not.toContain('SECRET_HOST_VALUE');
  });
});
