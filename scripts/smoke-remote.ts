import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_TIMEOUT_MS = 5_000;

type FetchLike = (url: string, init: { signal: AbortSignal }) => Promise<Response>;

type ProbeResult = {
  status: number | null;
  timedOut: boolean;
  health: boolean;
  parsed: boolean;
};

export type RemoteSmokeResult = {
  liveness: string;
  readiness: string;
  health: boolean;
  ok: boolean;
};

async function probe(
  fetchImpl: FetchLike,
  url: string,
  timeoutMs: number,
  readHealth: boolean,
): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    const status = response.status;
    if (!readHealth) {
      await response.body?.cancel();
      return { status, timedOut: false, health: false, parsed: false };
    }

    let health = false;
    let parsed = false;
    if (status === 200) {
      try {
        const payload: unknown = await response.json();
        if (typeof payload === 'object' && payload !== null && 'ok' in payload) {
          parsed = true;
          health = (payload as { ok: unknown }).ok === true;
        }
      } catch {
        parsed = false;
        health = false;
      }
    }
    return { status, timedOut: false, health, parsed };
  } catch {
    return {
      status: null,
      timedOut: controller.signal.aborted,
      health: false,
      parsed: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

function probeLabel(probeResult: ProbeResult, readHealth: boolean): string {
  if (probeResult.timedOut) return 'timeout';
  if (probeResult.status === null) return 'unreachable';
  if (probeResult.status < 200 || probeResult.status >= 300) return String(probeResult.status);
  if (!readHealth) return 'ok';
  if (!probeResult.parsed) return 'invalid';
  return probeResult.health ? 'ok' : 'not-ready';
}

export async function checkRemoteSmoke(
  baseUrl: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl: FetchLike = fetch,
): Promise<RemoteSmokeResult> {
  const url = new URL(baseUrl);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Base URL must use http or https.');
  }

  const normalized = baseUrl.replace(/\/+$/, '');
  const [frontend, health] = await Promise.all([
    probe(fetchImpl, normalized, timeoutMs, false),
    probe(fetchImpl, `${normalized}/api/_healthcheck`, timeoutMs, true),
  ]);

  const liveness = probeLabel(frontend, false);
  const readiness = probeLabel(health, true);
  return {
    liveness,
    readiness,
    health: readiness === 'ok',
    ok: liveness === 'ok' && readiness === 'ok',
  };
}

export function formatRemoteSmoke(result: RemoteSmokeResult): string {
  return `liveness: ${result.liveness}\nreadiness: ${result.readiness}\nhealth: ${result.health}`;
}

function invalidStatus(): number {
  console.error(
    formatRemoteSmoke({ liveness: 'invalid', readiness: 'invalid', health: false, ok: false }),
  );
  return 1;
}

export async function main(
  argv: string[] = process.argv.slice(2),
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<number> {
  const baseUrl = argv[0];
  if (!baseUrl) {
    return invalidStatus();
  }

  try {
    const result = await checkRemoteSmoke(baseUrl, timeoutMs);
    console.log(formatRemoteSmoke(result));
    return result.ok ? 0 : 1;
  } catch {
    return invalidStatus();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main();
}
