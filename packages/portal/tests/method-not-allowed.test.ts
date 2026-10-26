/**
 * Regression: unsupported methods on the portal host must answer 405, not crash.
 *
 * Incident (QUILL-AUDIT.md 2026-10-24, P1): `POST https://quill.maplespike.ca/...`
 * returned an empty reply and cloudflared rendered `502`. Cause:
 * `packages/portal/server.py` called `super().do_POST()` and friends, but
 * `http.server.BaseHTTPRequestHandler` implements no `do_POST`/`do_PUT`/
 * `do_PATCH`/`do_DELETE`/`do_OPTIONS`, so the handler raised
 * `AttributeError: 'super' object has no attribute 'do_POST'` and dropped the
 * socket with no response at all.
 *
 * This test starts the real server and drives it over HTTP, because the bug is
 * a socket-level failure that a source-text assertion cannot reproduce.
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';

const SERVER = join(__dirname, '..', 'server.py');

let dir: string;
let proc: ChildProcess | undefined;
let base = '';

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForReady(url: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
      lastErr = new Error(`status ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`portal did not become ready: ${String(lastErr)}`);
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'quill-portal-405-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>405 fixture</title>');
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  proc = spawn('python3', [SERVER], {
    env: { ...process.env, PORT: String(port), PORTAL_STATIC_DIR: dir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForReady(`${base}/`);
}, 30_000);

afterAll(() => {
  proc?.kill('SIGKILL');
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('portal: unsupported methods on non-/api paths', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
    test(`${method} answers 405 JSON with Allow instead of dropping the socket`, async () => {
      // A dropped socket throws here ("fetch failed"), which is the pre-fix
      // behaviour this test exists to catch.
      const res = await fetch(`${base}/v1/health`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: method === 'DELETE' ? undefined : '{}',
      });

      expect(res.status).toBe(405);
      expect(res.headers.get('content-type')).toContain('application/json');
      expect(res.headers.get('allow')).toBe('GET, HEAD, OPTIONS');
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe('METHOD_NOT_ALLOWED');
      expect(String(body.message)).toContain('/v1/health');
    });
  }

  test('the root path answers 405 too (no static path exemption)', async () => {
    const res = await fetch(`${base}/`, { method: 'POST', body: 'x=1' });
    expect(res.status).toBe(405);
    expect((await res.json()).error).toBe('METHOD_NOT_ALLOWED');
  });

  test('OPTIONS answers 204 with the allowed method list', async () => {
    const res = await fetch(`${base}/pricing`, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('allow')).toBe('GET, HEAD, OPTIONS');
    expect(res.headers.get('access-control-allow-methods')).toBe('GET, HEAD, OPTIONS');
  });

  test('GET /health is a cheap 200 for the chart probe', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  test('GET still serves the page (the fix did not break normal requests)', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('405 fixture');
  });
});
