/**
 * Browser test for the signup API-key reveal.
 *
 * No hardware passkey and no API server. Chromium gets a virtual authenticator.
 * Auth responses are fulfilled in the page. The portal itself is the real
 * Astro dev server, so this checks the page the user sees.
 *
 *   pnpm test:e2e:signup
 *   pnpm test:e2e:signup -- --headed
 *
 * Reuses a server already on http://localhost:4321. Otherwise starts
 * `astro dev` and stops it on exit.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { Browser, Page, Route } from 'playwright';

// Playwright reads PLAYWRIGHT_BROWSERS_PATH when its module loads. Cursor's
// sandbox points that variable at an empty cache. Drop it, before the import,
// when the user cache already has Chromium.
const forcedBrowsers = process.env.PLAYWRIGHT_BROWSERS_PATH;
const userBrowsers = `${homedir()}/.cache/ms-playwright`;
function hasChromium(dir: string | undefined): boolean {
  if (!dir || !existsSync(dir)) return false;
  try {
    return readdirSync(dir).some((name) => name.startsWith('chromium'));
  } catch {
    return false;
  }
}
if (forcedBrowsers && !hasChromium(forcedBrowsers) && hasChromium(userBrowsers)) {
  delete process.env.PLAYWRIGHT_BROWSERS_PATH;
}

function userChrome(headless: boolean): string | undefined {
  if (!hasChromium(userBrowsers)) return undefined;
  const prefix = headless ? 'chromium_headless_shell-' : 'chromium-';
  const dirs = readdirSync(userBrowsers).filter((name) => name.startsWith(prefix)).sort();
  for (const dir of dirs.reverse()) {
    const bin = headless
      ? `${userBrowsers}/${dir}/chrome-headless-shell-linux64/chrome-headless-shell`
      : `${userBrowsers}/${dir}/chrome-linux64/chrome`;
    if (existsSync(bin)) return bin;
  }
  return undefined;
}

const { chromium } = await import('playwright');

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const PORT = 4321;
const BASE = `http://localhost:${PORT}`;
const KEY = 'qk_e2e_full_key_not_a_slice_0123456789abcdef';
const headed = process.argv.includes('--headed');

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

function registrationOptions() {
  return {
    challenge: b64url(crypto.getRandomValues(new Uint8Array(32))),
    rp: { name: 'Quill', id: 'localhost' },
    user: {
      id: b64url(new TextEncoder().encode('user_e2e')),
      name: 'e2e@example.com',
      displayName: 'E2E User',
    },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    timeout: 60000,
    attestation: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform',
    },
  };
}

async function fulfill(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installAuthRoutes(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/oauth/providers')) {
      await fulfill(route, { data: { providers: [] } });
      return;
    }
    if (url.includes('/passkey/register/begin')) {
      await fulfill(route, {
        success: true,
        data: { options: registrationOptions(), registrationId: 'reg-e2e' },
      });
      return;
    }
    if (url.includes('/passkey/register/complete')) {
      await fulfill(route, { success: true, data: { apiKey: { key: KEY } } });
      return;
    }
    if (url.includes('/passkey/login/begin')) {
      await fulfill(route, { success: false, error: { message: 'skip login' } });
      return;
    }
    if (url.includes('/oauth/exchange')) {
      await fulfill(route, {
        success: true,
        data: {
          token: 'header.payload.sig',
          provider: 'github',
          name: 'e2e-user',
          isNewUser: true,
          apiKey: { key: KEY },
        },
      });
      return;
    }
    await route.fulfill({ status: 404, body: `unhandled ${url}` });
  });
}

async function installVirtualPasskey(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');
  await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}

function assertFullKey(label: string, text: string) {
  const shown = text.trim();
  if (shown !== KEY) {
    throw new Error(`${label}: expected the full key, got ${JSON.stringify(shown)}`);
  }
  if (shown.includes('...')) {
    throw new Error(`${label}: key is truncated`);
  }
}

async function upAlready(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/signup`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

function startPortal(): ChildProcess {
  const child = spawn(
    'pnpm',
    ['--filter', '@maplespike/portal', 'exec', 'astro', 'dev', '--host', 'localhost', '--port', String(PORT)],
    { cwd: ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const log = (chunk: Buffer) => process.stderr.write(chunk);
  child.stdout?.on('data', log);
  child.stderr?.on('data', log);
  return child;
}

async function waitForPortal(child: ChildProcess) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`portal dev exited ${child.exitCode}`);
    if (await upAlready()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`portal did not answer ${BASE}/signup within 90s`);
}

function stopPortal(child: ChildProcess) {
  if (child.pid && child.exitCode === null) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
  }
}

async function main() {
  const owned = !(await upAlready());
  const child = owned ? startPortal() : null;
  if (child) await waitForPortal(child);

  let browser: Browser | undefined;
  let page: Page | undefined;
  try {
    browser = await chromium.launch({
      headless: !headed,
      executablePath: userChrome(!headed),
    });
    page = await browser.newPage();
    page.setDefaultTimeout(20_000);
    await installAuthRoutes(page);

    await page.goto(`${BASE}/auth/callback?code=e2e`);
    const oauthKey = page.locator('#api-key-reveal-value');
    await oauthKey.waitFor({ state: 'visible' });
    assertFullKey('oauth callback', await oauthKey.innerText());
    const curl = await page.locator('#api-key-reveal-curl').innerText();
    if (!curl.includes(KEY) || !curl.includes('/v1/llms.txt')) {
      throw new Error(`oauth curl missing key or endpoint: ${curl}`);
    }
    const cont = page.locator('#api-key-reveal-continue');
    if ((await cont.getAttribute('href')) !== '/workspace?new=1') {
      throw new Error('oauth continue link does not go to the workspace welcome');
    }
    console.log('oauth reveal: pass');

    // The callback stored a session. Signup then renders "Account Active"
    // instead of the passkey button. Start that check signed out.
    await page.goto(`${BASE}/signup`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await installVirtualPasskey(page);
    await page.getByRole('button', { name: /create passkey/i }).click();
    const passkeyKey = page.getByTestId('api-key-value');
    await passkeyKey.waitFor({ state: 'visible' });
    assertFullKey('passkey signup', await passkeyKey.innerText());
    const stored = await page.evaluate(() => localStorage.getItem('quill-api-key'));
    if (stored !== KEY) throw new Error(`localStorage key is ${JSON.stringify(stored)}`);
    console.log('passkey reveal: pass');
  } catch (err) {
    const body = page ? await page.locator('body').innerText().catch(() => '') : '';
    if (body) console.error(body.slice(0, 1200));
    throw err;
  } finally {
    await browser?.close();
    if (child) stopPortal(child);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
