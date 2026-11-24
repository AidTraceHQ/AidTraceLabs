import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Keypair } from '@stellar/stellar-sdk';
import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';

type E2eState = {
  organizationAddress: string;
  verifiedRecipient: string;
  mismatchRecipient: string;
  recordIds: string[];
};

const statePath = process.env.AIDTRACE_E2E_STATE_PATH;
if (!statePath) throw new Error('AIDTRACE_E2E_STATE_PATH is required.');

let state: E2eState;
let pool: Pool;
let admin: Keypair;
let donor: Keypair;

test.beforeAll(async () => {
  state = JSON.parse(await readFile(statePath, 'utf8')) as E2eState;
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required.');
  pool = new Pool({ connectionString: databaseUrl });
  admin = Keypair.random();
  donor = Keypair.random();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const wallet of [admin.publicKey(), donor.publicKey()]) {
      await client.query('INSERT INTO users (wallet_address) VALUES ($1)', [wallet]);
    }
    await client.query(
      `INSERT INTO wallet_roles (wallet_address, role, updated_by)
       VALUES ($1, 'admin', $1)`,
      [admin.publicKey()],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

test.afterAll(async () => {
  if (admin && donor) {
    const addresses = [admin.publicKey(), donor.publicKey()];
    const rateLimitKeys = addresses.flatMap((address) =>
      ['challenge', 'verify'].map((action) =>
        createHash('sha256')
          .update(action + ':' + address)
          .digest('hex'),
      ),
    );
    await pool.query(
      `DELETE FROM audit_events
       WHERE actor_wallet = ANY($1::text[]) OR subject_wallet = ANY($1::text[])`,
      [addresses],
    );
    await pool.query('DELETE FROM rate_limits WHERE key_hash = ANY($1::text[])', [rateLimitKeys]);
    await pool.query('DELETE FROM sessions WHERE wallet_address = ANY($1::text[])', [addresses]);
    await pool.query('DELETE FROM challenges WHERE wallet_address = ANY($1::text[])', [addresses]);
    await pool.query(
      `DELETE FROM wallet_roles
       WHERE wallet_address = ANY($1::text[]) OR updated_by = ANY($1::text[])`,
      [addresses],
    );
    await pool.query('DELETE FROM users WHERE wallet_address = ANY($1::text[])', [addresses]);
  }
  if (pool) await pool.end();
});

async function preparePage(page: Page, wallet: Keypair) {
  const unexpectedRequests: string[] = [];
  const horizonRequests: string[] = [];

  await page.exposeFunction('__aidtraceSignMessage', (message: string) => {
    const digest = createHash('sha256')
      .update('Stellar Signed Message:\n')
      .update(message, 'utf8')
      .digest();
    return Buffer.from(wallet.sign(digest)).toString('base64');
  });
  await page.addInitScript((address) => {
    type TestWindow = Window & {
      freighter?: boolean;
      __aidtraceFreighterCalls?: string[];
      __aidtraceSignMessage?: (message: string) => Promise<string>;
    };
    const testWindow = window as TestWindow;
    testWindow.freighter = true;
    testWindow.__aidtraceFreighterCalls = [];
    window.addEventListener('message', (event: MessageEvent) => {
      const request = event.data as Record<string, unknown> | null;
      if (event.source !== window || request?.source !== 'FREIGHTER_EXTERNAL_MSG_REQUEST') return;

      const type = String(request.type || '');
      testWindow.__aidtraceFreighterCalls?.push(type);
      void (async () => {
        let response: Record<string, unknown>;
        if (type === 'REQUEST_ACCESS') {
          response = { publicKey: address };
        } else if (type === 'REQUEST_NETWORK_DETAILS') {
          response = {
            networkDetails: {
              network: 'TESTNET',
              networkPassphrase: 'Test SDF Network ; September 2015',
            },
          };
        } else if (type === 'REQUEST_ALLOWED_STATUS') {
          response = { isAllowed: true };
        } else if (type === 'SUBMIT_BLOB' && typeof request.blob === 'string') {
          const sign = testWindow.__aidtraceSignMessage;
          if (!sign) throw new Error('The generated test signer was not installed.');
          response = {
            signedBlob: await sign(request.blob),
            signerAddress: address,
          };
        } else {
          response = {
            apiError: { code: -1, message: 'Unexpected Freighter API request: ' + type },
          };
        }
        window.postMessage(
          {
            source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE',
            messagedId: request.messageId,
            ...response,
          },
          window.location.origin,
        );
      })();
    });
  }, wallet.publicKey());

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://localhost:5173') {
      await route.continue();
      return;
    }
    if (url.origin === 'https://horizon-testnet.stellar.org') {
      horizonRequests.push(url.href);
      if (url.pathname.endsWith('/payments') && url.searchParams.get('cursor') === 'now') {
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: ': connected\n\n',
        });
        return;
      }
      if (url.pathname.includes('/accounts/') && url.pathname.endsWith('/payments')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{"_embedded":{"records":[]}}',
        });
        return;
      }
      if (url.pathname.includes('/accounts/') && url.pathname.endsWith('/transactions')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{"_embedded":{"records":[]}}',
        });
        return;
      }
      if (url.pathname.includes('/accounts/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{"balances":[{"asset_type":"native","balance":"0.0000000"}]}',
        });
        return;
      }
    }
    unexpectedRequests.push(url.href);
    await route.abort();
  });

  return { unexpectedRequests, horizonRequests };
}

async function signIn(page: Page, wallet: Keypair) {
  const network = await preparePage(page, wallet);
  await page.goto('/');
  await page.getByRole('button', { name: 'Connect Freighter' }).click();
  await expect(page.getByRole('status')).toContainText('Wallet ownership verified.');
  return network;
}

function expectNoExternalRequests(network: {
  unexpectedRequests: string[];
  horizonRequests: string[];
}) {
  expect(network.unexpectedRequests).toEqual([]);
  expect(
    network.horizonRequests.every((url) => new URL(url).hostname === 'horizon-testnet.stellar.org'),
  ).toBe(true);
}

async function expectProviderAndNetworkIsolation(
  page: Page,
  network: { unexpectedRequests: string[]; horizonRequests: string[] },
) {
  const calls = await page.evaluate(
    () =>
      (window as Window & { __aidtraceFreighterCalls?: string[] }).__aidtraceFreighterCalls || [],
  );
  expect(calls).toEqual([
    'REQUEST_ACCESS',
    'REQUEST_NETWORK_DETAILS',
    'REQUEST_ALLOWED_STATUS',
    'SUBMIT_BLOB',
  ]);
  expectNoExternalRequests(network);
}

test('logs in with a generated Freighter signature and shows admin-only UI', async ({ page }) => {
  const network = await signIn(page, admin);

  await expect(page.locator('.role-pill')).toHaveText('admin');
  await expect(page.getByRole('button', { name: 'Administration' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Beneficiary Records' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add record' })).toBeVisible();
  await expect.poll(() => network.horizonRequests.length).toBeGreaterThan(0);
  await expectProviderAndNetworkIsolation(page, network);
});

test('filters the ledger and distinguishes verified records from mismatches', async ({ page }) => {
  const network = await preparePage(page, donor);
  await page.goto('/');

  await page.getByLabel('Filter organization').selectOption(state.organizationAddress);
  await expect(page.getByText('E2E Verified ', { exact: false })).toBeVisible();
  await expect(page.getByText('E2E Mismatch ', { exact: false })).toBeVisible();
  await expect(page.getByText('Verified on-chain', { exact: true })).toBeVisible();
  await expect(page.getByText('Mismatch', { exact: true })).toBeVisible();

  await page.getByLabel('Filter status').selectOption('mismatch');
  await expect(page.getByText('E2E Mismatch ', { exact: false })).toBeVisible();
  await expect(page.getByText('E2E Verified ', { exact: false })).toHaveCount(0);

  await page.getByLabel('Filter status').selectOption('all');
  const mismatchRow = page.getByRole('row').filter({ hasText: 'E2E Mismatch ' });
  await mismatchRow.getByRole('button', { name: 'View' }).click();
  await expect(page.getByText('Amount does not match the published record.')).toBeVisible();
  expectNoExternalRequests(network);
});

test('shows only role-appropriate sections for a donor', async ({ page }) => {
  const network = await signIn(page, donor);

  await expect(page.locator('.role-pill')).toHaveText('donor');
  await expect(page.getByRole('button', { name: 'My Activity' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Administration' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Beneficiary Records' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add record' })).toHaveCount(0);
  await expect.poll(() => network.horizonRequests.length).toBeGreaterThan(0);
  await expectProviderAndNetworkIsolation(page, network);
});

test('signs out and restores the disconnected UI', async ({ page }) => {
  const network = await signIn(page, donor);

  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Connect Freighter' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'My Activity' })).toHaveCount(0);
  await expectProviderAndNetworkIsolation(page, network);
});
