import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  api,
  attachSessionFocusRefresh,
  createSessionState,
  sessionHasRole,
  setSessionAuthErrorHandler,
  type Session,
} from '../src/api.js';

const admin: Session = {
  address: 'GADMIN',
  network: 'testnet',
  role: 'admin',
  expiresAt: '2026-11-20T00:00:00.000Z',
  csrfToken: 'admin-token',
};
const donor: Session = { ...admin, role: 'donor', csrfToken: 'donor-token' };

const meResponse = (session: Session | null) =>
  new Response(JSON.stringify({ session }), { status: 200 });

beforeEach(() => {
  vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  setSessionAuthErrorHandler(undefined);
});

describe('session role reconciliation', () => {
  it('reconciles the role from /api/me on focus without a full reload', async () => {
    let current = admin;
    const fetchMock = vi.fn(async () => meResponse(current));
    vi.stubGlobal('fetch', fetchMock);
    const state = createSessionState({ minIntervalMs: 0 });
    const target = new EventTarget();
    const detach = attachSessionFocusRefresh(state, target);

    await state.refresh();
    expect(state.getSession()?.role).toBe('admin');
    expect(sessionHasRole(state.getSession(), 'admin')).toBe(true);

    current = donor;
    target.dispatchEvent(new Event('focus'));
    await vi.waitFor(() => expect(state.getSession()?.role).toBe('donor'));
    expect(sessionHasRole(state.getSession(), 'admin')).toBe(false);
    expect(sessionHasRole(state.getSession(), 'donor')).toBe(true);
    detach();
  });

  it('hides the privileged control on a 403 even when state still holds admin', async () => {
    const state = createSessionState({ minIntervalMs: 0 });
    state.setSession(admin);
    expect(sessionHasRole(state.getSession(), 'admin')).toBe(true);
    setSessionAuthErrorHandler((error) => {
      void state.onAuthError(error);
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown) => {
        if (String(input).includes('/api/me')) return meResponse(donor);
        return new Response(JSON.stringify({ error: 'Forbidden.' }), { status: 403 });
      }),
    );

    await expect(api.get('/api/admin/roles')).rejects.toBeInstanceOf(ApiError);
    expect(sessionHasRole(state.getSession(), 'admin')).toBe(false);
    await vi.waitFor(() => expect(state.getSession()?.role).toBe('donor'));
    expect(sessionHasRole(state.getSession(), 'admin')).toBe(false);
  });

  it('clears the session on a 401 without restoring stale privileges', async () => {
    const state = createSessionState({ minIntervalMs: 0 });
    state.setSession(admin);
    setSessionAuthErrorHandler((error) => {
      void state.onAuthError(error);
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown) => {
        if (String(input).includes('/api/me')) return meResponse(null);
        return new Response(JSON.stringify({ error: 'Session expired.' }), { status: 401 });
      }),
    );

    await expect(api.get('/api/records/record-id')).rejects.toMatchObject({ status: 401 });
    expect(state.getSession()).toBeNull();
    await vi.waitFor(() => expect(state.getSession()).toBeNull());
  });

  it('bounds /api/me reads when focus fires many times in a short window', async () => {
    const fetchMock = vi.fn(async (_input: unknown) => meResponse(admin));
    vi.stubGlobal('fetch', fetchMock);
    const state = createSessionState();
    const target = new EventTarget();
    const detach = attachSessionFocusRefresh(state, target);

    for (let index = 0; index < 30; index += 1) target.dispatchEvent(new Event('focus'));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const meCalls = fetchMock.mock.calls.filter(([input]) => String(input).includes('/api/me'));
    expect(meCalls.length).toBeGreaterThanOrEqual(1);
    expect(meCalls.length).toBeLessThanOrEqual(2);
    detach();
  });
});
