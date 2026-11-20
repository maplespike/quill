/**
 * HTTP route smoke test for Quill MCP server (index.ts SSE mode).
 *
 * Boots `src/index.ts` as a child process with `PORT=<free-port>` + `NODE_ENV=test`,
 * then issues real HTTP requests against the documented routes to lock in
 * the green state of:
 *
 *   GET  /                 → 301 → /sse  (root redirect)
 *   GET  /health           → 200 {status, tools}
 *   GET  /sse              → 401 without a credential; 200 stream with a valid key or JWT
 *   POST /mcp              → 401 without a credential; JSON-RPC with a valid key or JWT
 *   POST /messages         → 404 (no SSE client without clientId)
 *   GET  /random           → 404 NOT_FOUND
 *
 * Skipped automatically when SKIP_NETWORK_TESTS=1 (used by air-gapped CI).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { createHmac } from 'node:crypto';
import { createServer as createHttpServer, request as httpRequest, type IncomingMessage, type Server } from 'node:http';

const SKIP = process.env.SKIP_NETWORK_TESTS === '1';
const SKIP_REASON = 'SKIP_NETWORK_TESTS=1';
const TEST_JWT_SECRET = 'test-jwt-secret-not-a-production-value';

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function signTestJwt(claims: Record<string, unknown>, secret = TEST_JWT_SECRET): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify(claims));
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

/**
 * Asserts that a fetched JSON body contains every named field, catching
 * silent regressions where the server changes its response shape (rename,
 * removal). Cheap and noisy in a good way.
 */
function ensureFields(body: Record<string, unknown>, fields: string[]): void {
  for (const f of fields) {
    assert.ok(f in body, `expected field "${f}" in response, got keys: ${Object.keys(body).join(', ')}`);
  }
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (typeof addr === 'string' || addr === null) {
        reject(new Error('failed to allocate free port'));
        return;
      }
      const port = addr.port;
      srv.close(() => resolve(port));
    });
  });
}

// Cold start registers the full tool set. On a loaded CI runner that has
// taken about 16s (stdio handshake in the same job). A 10s cap fails the
// first SSE spawn with "fetch failed" before /health is listening.
// The SSE session-limit tests below start up to four servers at once, so
// allow for CPU contention: on 2026-11-01 (run 41292001889) a single cold
// start took ~20s, and a serialised file blew its 180s --test-timeout.
async function waitForReady(url: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  let lastErr: unknown = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server did not respond at ${url} within ${timeoutMs}ms (last error: ${String(lastErr)})`);
}

/**
 * Stop the spawned server AND its whole process group.
 *
 * The server runs directly under Node. `detached: true` gives it a process
 * group so cleanup also reaches logging workers. The previous pnpm wrapper
 * left the actual server alive when only the wrapper was killed; its open
 * pipes kept the test process alive until the CI job timeout.
 *
 * Also: `proc.killed` is NOT a liveness check — it flips true the moment
 * kill() is CALLED, not when the process exits, so the previous
 * `if (!proc.killed) proc.kill('SIGKILL')` fallback could never fire. Wait on
 * the real 'exit' event instead.
 */
async function stopServer(proc: ChildProcess | undefined): Promise<void> {
  if (!proc || proc.pid === undefined || proc.exitCode !== null) return;

  // Attach the exit listener BEFORE signalling so a fast exit cannot be missed.
  const exited = once(proc, 'exit');
  try {
    process.kill(-proc.pid, 'SIGTERM');
  } catch {
    proc.kill('SIGTERM'); // group already gone — signal the direct child
  }

  const graceful = await Promise.race([
    exited.then(() => true),
    new Promise<boolean>((r) => setTimeout(() => r(false), 2000)),
  ]);

  if (!graceful) {
    try {
      process.kill(-proc.pid, 'SIGKILL');
    } catch {
      proc.kill('SIGKILL');
    }
  }
}

describe('quill-mcp index.ts HTTP routes', { skip: SKIP && SKIP_REASON }, () => {
  let port: number;
  let proc: ChildProcess;
  let baseUrl: string;

  before(async () => {
    port = await getFreePort();
    baseUrl = `http://127.0.0.1:${port}`;
    const pkgRoot = new URL('../..', import.meta.url).pathname;

    // Launch Node directly so shutdown assertions observe the server's exit,
    // not a pnpm wrapper killed by the same process-group signal.
    proc = spawn(
      process.execPath,
      process.env.QUILL_TEST_BUILT === '1'
        ? ['dist/index.js']
        : ['--import', 'tsx', 'src/index.ts'],
      {
        cwd: pkgRoot,
        env: {
          ...process.env,
          PORT: String(port),
          QUILL_MCP_METRICS_PORT: '0',
          NODE_ENV: 'test',
          QUILL_API_URL: '',
          ASTRAL_KEY_URL: '',
          QUILL_LOG_LEVEL: 'silent',
          LOG_LEVEL: 'silent',
          TRUST_PROXY: 'false',
          QUOTA_ENABLED: 'true',
          QUOTA_PERSIST_PATH: '',
          QUILL_API_KEY: 'test-secret-key', // non-dev key so auth is enforced
          JWT_SECRET: TEST_JWT_SECRET,
          X402_ENABLED: 'false',

        },
        stdio: ['ignore', 'pipe', 'pipe'],
        // Keep any worker descendants in the server's process group for cleanup.
        detached: true,
      },
    );

    proc.on('error', (err) => {
      console.error('[test] child process error:', err);
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      if (process.env.VERBOSE_TESTS === '1') {
        process.stderr.write(`[index.ts stderr] ${chunk.toString()}`);
      }
    });

    await waitForReady(`${baseUrl}/health`);
  });

  // Sanity check the spawn worked before any sub-test runs (faster failure
  // surface than waiting for every subtest to time out).
  // `exitCode !== null` is the real liveness signal — `proc.killed` only
  // records that a signal was SENT (see stopServer).
  before((t) => {
    if (!proc || proc.exitCode !== null) {
      t.skip('index.ts child process failed to spawn — see stderr from before() hook');
    }
  });

  after(async () => {
    // Kill the whole process group — the server is a grandchild of `pnpm`,
    // and an orphaned server keeps this process alive forever (see stopServer).
    await stopServer(proc);
  });

  it('GET /health returns 200 with stable response shape', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    const body = await res.json() as Record<string, unknown>;
    ensureFields(body, ['status', 'tools']);
    assert.equal(body.status, 'ok');
    assert.equal(typeof body.tools, 'number');
    assert.ok((body.tools as number) > 0, 'expected at least 1 registered tool');
  });

  it('GET / returns 301 redirect to /sse', async () => {
    const res = await fetch(baseUrl, { redirect: 'manual' });
    assert.equal(res.status, 301);
    const location = res.headers.get('location');
    assert.equal(location, '/sse');
  });

  it('GET /sse without a credential returns 401', async () => {
    const res = await fetch(`${baseUrl}/sse`);
    assert.equal(res.status, 401);
    assert.match(res.headers.get('www-authenticate') || '', /^Bearer realm="quill"/);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.error, 'Unauthorized');
  });

  it('GET /sse with a valid API key opens the stream', async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/sse`, {
      headers: { 'X-API-Key': 'test-secret-key' },
      signal: controller.signal,
    });
    try {
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /text\/event-stream/);
    } finally {
      controller.abort();
      await res.body?.cancel().catch(() => {});
    }
  });

  it('POST /mcp rejects missing and invalid credentials and accepts a key or JWT', async () => {
    const initialize = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'auth-test', version: '1' } },
    };
    const post = (headers: Record<string, string>) => fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(initialize),
    });

    const missing = await post({});
    assert.equal(missing.status, 401);
    assert.match(missing.headers.get('www-authenticate') || '', /^Bearer realm="quill"/);
    assert.equal((await missing.json() as Record<string, unknown>).error, 'Unauthorized');

    const invalid = await post({ Authorization: 'Bearer not-a-real-key' });
    assert.equal(invalid.status, 401);
    assert.equal((await invalid.json() as Record<string, unknown>).error, 'Unauthorized');

    const now = Math.floor(Date.now() / 1000);
    const badJwt = signTestJwt({ sub: 'user-1', tier: 'pro', iss: 'maplespike', aud: 'quill-api', iat: now, exp: now + 60 }, 'wrong-secret');
    const badJwtRes = await post({ Authorization: `Bearer ${badJwt}` });
    assert.equal(badJwtRes.status, 401);

    const keyed = await post({ Authorization: 'Bearer test-secret-key' });
    assert.equal(keyed.status, 200);
    const keyedBody = await keyed.json() as { id?: number; result?: { protocolVersion?: string } };
    assert.equal(keyedBody.id, 1);
    assert.equal(typeof keyedBody.result?.protocolVersion, 'string');

    const jwt = signTestJwt({ sub: 'user-1', tier: 'pro', iss: 'maplespike', aud: 'quill-api', iat: now, exp: now + 3600 });
    const jwtRes = await post({ Authorization: `Bearer ${jwt}` });
    assert.equal(jwtRes.status, 200);
    const jwtBody = await jwtRes.json() as { result?: { serverInfo?: { name?: string } } };
    assert.equal(jwtBody.result?.serverInfo?.name, 'maplespike-canada-mcp');

    const expired = signTestJwt({ sub: 'user-1', tier: 'pro', iss: 'maplespike', aud: 'quill-api', iat: now - 120, exp: now - 60 });
    const expiredRes = await post({ Authorization: `Bearer ${expired}` });
    assert.equal(expiredRes.status, 401);
  });

  it('GET /mcp without a credential returns 401 and a valid key is not a stream', async () => {
    const missing = await fetch(`${baseUrl}/mcp`);
    assert.equal(missing.status, 401);
    const authed = await fetch(`${baseUrl}/mcp`, { headers: { Authorization: 'Bearer test-secret-key' } });
    assert.equal(authed.status, 405);
    assert.match(authed.headers.get('allow') || '', /POST/);
  });

  it('GET /sse with a valid API session JWT opens the stream', async () => {
    const now = Math.floor(Date.now() / 1000);
    const jwt = signTestJwt({ sub: 'user-1', tier: 'pro', iss: 'maplespike', aud: 'quill-api', iat: now, exp: now + 3600 });
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/sse`, {
      headers: { Authorization: `Bearer ${jwt}` },
      signal: controller.signal,
    });
    try {
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /text\/event-stream/);
    } finally {
      controller.abort();
      await res.body?.cancel().catch(() => {});
    }
  });

  it('GET /sse with a wrong bearer returns 401 with a challenge', async () => {
    const res = await fetch(`${baseUrl}/sse`, { headers: { Authorization: 'Bearer not-a-real-key' } });
    assert.equal(res.status, 401);
    assert.match(res.headers.get('www-authenticate') || '', /^Bearer realm="quill"/);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.error, 'Unauthorized');
  });

  it('POST /messages without a credential returns 401', async () => {
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });
    assert.equal(res.status, 401);
    assert.equal((await res.json() as Record<string, unknown>).error, 'Unauthorized');
  });

  it('POST /messages with a valid key and no session returns 404', async () => {
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-secret-key',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });
    assert.equal(res.status, 404);
    const body = await res.json() as Record<string, unknown>;
    assert.ok(typeof body.error === 'string');
  });

  it('GET /unknown-path returns 404 NOT_FOUND', async () => {
    const res = await fetch(`${baseUrl}/nope-this-does-not-exist`);
    assert.equal(res.status, 404);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.error, 'Not found');
    assert.equal(body.path, '/nope-this-does-not-exist');
  });

  it('authenticated SSE uses standard framing and owner-bound message delivery', async () => {
    const controller = new AbortController();
    const headers = { Authorization: 'Bearer test-secret-key' };
    const stream = await fetch(`${baseUrl}/sse`, { headers, signal: controller.signal });
    assert.equal(stream.status, 200);
    const reader = stream.body!.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    async function event(): Promise<{ name: string; data: string }> {
      while (!pending.includes('\n\n')) {
        const chunk = await reader.read();
        assert.equal(chunk.done, false, 'stream ended before its response');
        pending += decoder.decode(chunk.value, { stream: true });
      }
      const end = pending.indexOf('\n\n');
      const frame = pending.slice(0, end);
      pending = pending.slice(end + 2);
      return {
        name: frame.split('\n').find(line => line.startsWith('event: '))?.slice(7) ?? '',
        data: frame.split('\n').filter(line => line.startsWith('data: ')).map(line => line.slice(6)).join('\n'),
      };
    }
    try {
      const endpoint = await event();
      assert.equal(endpoint.name, 'endpoint');
      assert.match(endpoint.data, /^\/messages\?clientId=[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      const target = new URL(endpoint.data, baseUrl);
      assert.equal(target.origin, baseUrl);
      const post = (body: unknown, authorization?: string) => fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
        body: JSON.stringify(body),
      });
      const request = (id: number, method: string, params = {}) => ({ jsonrpc: '2.0', id, method, params });
      const initialize = request(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'route-test', version: '1' } });
      assert.equal((await post(initialize)).status, 401);
      assert.equal((await post(initialize, 'Bearer wrong-owner')).status, 401);
      // The configured key's base64 alias is also valid auth, but is not this stream's owner.
      assert.equal((await post(initialize, `Bearer ${Buffer.from('test-secret-key').toString('base64')}`)).status, 401);
      assert.equal((await post(initialize, headers.Authorization)).status, 202);
      const initialized = await event();
      assert.equal(initialized.name, 'message');
      assert.equal(JSON.parse(initialized.data).id, 1);
      assert.equal((await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, headers.Authorization)).status, 202);
      assert.equal((await post(request(2, 'tools/list'), headers.Authorization)).status, 202);
      const listed = JSON.parse((await event()).data);
      assert.equal(listed.id, 2);
      assert.equal(listed.result.tools.length, 186);
      assert.equal(listed.result._quota.mode, 'api-key');
      assert.equal((await post(request(3, 'tools/call', { name: 'explore_catalog', arguments: {} }), headers.Authorization)).status, 202);
      const called = JSON.parse((await event()).data);
      assert.equal(called.id, 3);
      assert.ok(called.result.content.length > 0);
      assert.notEqual(called.result.isError, true);

      // Teardown must work while the SSE response is still open.
      const exited = once(proc, 'exit');
      process.kill(-proc.pid!, 'SIGTERM');
      let timeout: NodeJS.Timeout | undefined;
      try {
        const code = await Promise.race([
          exited.then(([code]) => code),
          new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('SIGTERM did not close the active SSE stream')), 5000); }),
        ]);
        assert.equal(code, 0);
      } finally {
        clearTimeout(timeout);
      }
    } finally {
      controller.abort();
      await reader.cancel().catch(() => {});
    }
  });

});

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (typeof address === 'string' || address === null) throw new Error('no port');
  return address.port;
}

function startIndex(port: number, env: Record<string, string>): ChildProcess {
  const pkgRoot = new URL('../..', import.meta.url).pathname;
  return spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: pkgRoot,
    env: {
      ...process.env,
      PORT: String(port),
      QUILL_MCP_METRICS_PORT: '0',
      NODE_ENV: 'test',
      QUILL_API_URL: '',
      ASTRAL_KEY_URL: '',
      QUILL_LOG_LEVEL: 'silent',
      LOG_LEVEL: 'silent',
      TRUST_PROXY: 'false',
      QUOTA_ENABLED: 'true',
      QUOTA_PERSIST_PATH: '',
      QUILL_API_KEY: 'test-secret-key',
      JWT_SECRET: TEST_JWT_SECRET,
      X402_ENABLED: 'false',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
}

describe('Astral Key verification', { skip: SKIP && SKIP_REASON }, () => {
  it('uses the Astral Key API route and rejects errors or invalid tokens', async () => {
    const requests: Array<{ url: string | undefined; method: string | undefined; token: string; audience?: string; requiredScopes?: string[] }> = [];
    const astral = createHttpServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const { token, audience, required_scopes } = JSON.parse(Buffer.concat(chunks).toString()) as {
        token: string; audience?: string; required_scopes?: string[];
      };
      requests.push({ url: req.url, method: req.method, token, audience, requiredScopes: required_scopes });
      if (token === 'disconnect-token') {
        req.socket.destroy();
        return;
      }
      res.writeHead(token === 'error-token' ? 503 : 200, { 'Content-Type': 'application/json' });
      if (token === 'malformed-token') return res.end('{');
      if (token === 'nonboolean-token') return res.end(JSON.stringify({ valid: 'true' }));
      res.end(JSON.stringify({ valid: token !== 'invalid-token' }));
    });
    const astralPort = await listen(astral);
    const port = await getFreePort();
    const proc = startIndex(port, {
      ASTRAL_KEY_URL: `http://127.0.0.1:${astralPort}/`,
      ASTRAL_KEY_AUDIENCE: 'quill-mcp',
      ASTRAL_KEY_SCOPES: 'mcp:tools:call:read, mcp:tools:list',
    });
    const base = `http://127.0.0.1:${port}`;
    try {
      await waitForReady(`${base}/health`);
      const cases = [
        ['accepted-token', 200], ['invalid-token', 401], ['error-token', 401],
        ['malformed-token', 401], ['nonboolean-token', 401], ['disconnect-token', 401],
      ] as const;
      for (const [token, expected] of cases) {
        const response = await fetch(`${base}/mcp`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
        });
        assert.equal(response.status, expected);
      }
      assert.deepEqual(requests, cases.map(([token]) => ({
        url: '/api/v1/auth/verify',
        method: 'POST',
        token,
        audience: 'quill-mcp',
        requiredScopes: ['mcp:tools:call:read', 'mcp:tools:list'],
      })));
    } finally {
      await stopServer(proc);
      await new Promise<void>((resolve, reject) => astral.close(err => err ? reject(err) : resolve()));
    }
  });
});

// Cold start of src/index.ts (tsx + 184 tool modules) measured ~20 s per
// server on a loaded CI runner. Every test below spawns its own server, so
// run them concurrently: the spawns overlap instead of serialising nine
// cold starts, which is what pushed this file past the 180 s per-file
// --test-timeout on 2026-11-01 (run 41292001889, job 124806492935) and
// starved the 15-minute job budget. Each test owns its own port and child
// process group (stopServer), so there is no shared state between them.
describe('SSE session limits', { skip: SKIP && SKIP_REASON, concurrency: 4 }, () => {
  it('keeps each session message on that session stream', async () => {
    const port = await getFreePort();
    const proc = startIndex(port, {});
    const base = `http://127.0.0.1:${port}`;
    try {
      await waitForReady(`${base}/health`);
      const headers = { Authorization: 'Bearer test-secret-key' };
      const open = async () => {
        const controller = new AbortController();
        const stream = await fetch(`${base}/sse`, { headers, signal: controller.signal });
        const reader = stream.body!.getReader();
        const decoder = new TextDecoder();
        let pending = '';
        const next = async () => {
          while (!pending.includes('\n\n')) {
            const chunk = await reader.read();
            if (chunk.done) return null;
            pending += decoder.decode(chunk.value, { stream: true });
          }
          const end = pending.indexOf('\n\n');
          const frame = pending.slice(0, end);
          pending = pending.slice(end + 2);
          return frame;
        };
        const endpoint = await next();
        const id = endpoint?.match(/clientId=([0-9a-f-]+)/)?.[1];
        return { controller, reader, next, id };
      };
      const a = await open();
      const b = await open();
      assert.ok(a.id && b.id && a.id !== b.id);
      const posted = await fetch(`${base}/messages?clientId=${a.id}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/list', params: {} }),
      });
      assert.equal(posted.status, 202);
      const frame = await a.next();
      assert.match(frame ?? '', /"id":7/);
      const other = await Promise.race([
        b.next().then((value) => value ?? 'closed'),
        new Promise<string>((resolve) => setTimeout(() => resolve('quiet'), 400)),
      ]);
      assert.equal(other, 'quiet');
      a.controller.abort();
      b.controller.abort();
    } finally {
      await stopServer(proc);
    }
  });

  it('rejects a tenant key after the API revokes it and drops the stream', async () => {
    let valid = true;
    const api = createHttpServer((req, res) => {
      if (req.url === '/v1/auth/me' && valid) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: { tenant: { id: 'tenant-1' } } }));
        return;
      }
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'revoked' }));
    });
    const apiPort = await listen(api);
    const port = await getFreePort();
    const proc = startIndex(port, { QUILL_API_URL: `http://127.0.0.1:${apiPort}` });
    const base = `http://127.0.0.1:${port}`;
    try {
      await waitForReady(`${base}/health`);
      const headers = { Authorization: 'Bearer tenant-live-key' };
      const controller = new AbortController();
      const stream = await fetch(`${base}/sse`, { headers, signal: controller.signal });
      assert.equal(stream.status, 200);
      const reader = stream.body!.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      while (!pending.includes('\n\n')) {
        const chunk = await reader.read();
        pending += decoder.decode(chunk.value, { stream: true });
      }
      const clientId = pending.match(/clientId=([0-9a-f-]+)/)?.[1];
      valid = false;
      const denied = await fetch(`${base}/messages?clientId=${clientId}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      assert.equal(denied.status, 401);
      const again = await fetch(`${base}/messages?clientId=${clientId}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
      });
      assert.equal(again.status, 404);
      controller.abort();
    } finally {
      await stopServer(proc);
      await new Promise<void>((resolve) => api.close(() => resolve()));
    }
  });

  it('refuses a new session when the connection cap is full', async () => {
    const port = await getFreePort();
    const proc = startIndex(port, { QUILL_SSE_MAX_CLIENTS: '1' });
    const base = `http://127.0.0.1:${port}`;
    const controller = new AbortController();
    try {
      await waitForReady(`${base}/health`);
      const headers = { Authorization: 'Bearer test-secret-key' };
      const first = await fetch(`${base}/sse`, { headers, signal: controller.signal });
      assert.equal(first.status, 200);
      const second = await fetch(`${base}/sse`, { headers });
      assert.equal(second.status, 503);
      await second.body?.cancel();
    } finally {
      controller.abort();
      await stopServer(proc);
    }
  });

  it('closes an idle session', async () => {
    const port = await getFreePort();
    const proc = startIndex(port, { QUILL_SSE_IDLE_MS: '300' });
    const base = `http://127.0.0.1:${port}`;
    try {
      await waitForReady(`${base}/health`);
      const stream = await fetch(`${base}/sse`, { headers: { Authorization: 'Bearer test-secret-key' } });
      assert.equal(stream.status, 200);
      const reader = stream.body!.getReader();
      const done = await Promise.race([
        (async () => {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) return 'closed';
          }
        })(),
        new Promise<string>((resolve) => setTimeout(() => resolve('open'), 2000)),
      ]);
      assert.equal(done, 'closed');
    } finally {
      await stopServer(proc);
    }
  });

  it('rejects an oversized declared body before running a command', async () => {
    const port = await getFreePort();
    const proc = startIndex(port, {});
    const base = `http://127.0.0.1:${port}`;
    const controller = new AbortController();
    try {
      await waitForReady(`${base}/health`);
      const headers = { Authorization: 'Bearer test-secret-key' };
      const stream = await fetch(`${base}/sse`, { headers, signal: controller.signal });
      const reader = stream.body!.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      while (!pending.includes('\n\n')) {
        const chunk = await reader.read();
        pending += decoder.decode(chunk.value, { stream: true });
      }
      const clientId = pending.match(/clientId=([0-9a-f-]+)/)?.[1];
      const denied = await fetch(`${base}/messages?clientId=${clientId}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: `{"pad":"${'x'.repeat(1024 * 1024 + 32)}"}`,
      });
      assert.equal(denied.status, 413);
      const listed = await fetch(`${base}/messages?clientId=${clientId}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/list' }),
      });
      assert.equal(listed.status, 202);
    } finally {
      controller.abort();
      await stopServer(proc);
    }
  });

  it('forgets a session after the client disconnects', async () => {
    const port = await getFreePort();
    const proc = startIndex(port, {});
    const base = `http://127.0.0.1:${port}`;
    try {
      await waitForReady(`${base}/health`);
      const headers = { Authorization: 'Bearer test-secret-key' };
      const controller = new AbortController();
      const stream = await fetch(`${base}/sse`, { headers, signal: controller.signal });
      const reader = stream.body!.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      while (!pending.includes('\n\n')) {
        const chunk = await reader.read();
        pending += decoder.decode(chunk.value, { stream: true });
      }
      const clientId = pending.match(/clientId=([0-9a-f-]+)/)?.[1];
      controller.abort();
      await reader.cancel().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 200));
      const posted = await fetch(`${base}/messages?clientId=${clientId}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      assert.equal(posted.status, 404);
    } finally {
      await stopServer(proc);
    }
  });

  it('gives each credential its own rate-limit bucket behind one peer', async () => {
    const port = await getFreePort();
    const proc = startIndex(port, { TRUST_PROXY: 'true' });
    const base = `http://127.0.0.1:${port}`;
    const alias = Buffer.from('test-secret-key').toString('base64');
    const controllers: AbortController[] = [];
    try {
      await waitForReady(`${base}/health`);
      const open = async (authorization: string) => {
        const controller = new AbortController();
        controllers.push(controller);
        const headers = { Authorization: authorization, 'X-Forwarded-For': '203.0.113.9' };
        const stream = await fetch(`${base}/sse`, { headers, signal: controller.signal });
        assert.equal(stream.status, 200);
        const reader = stream.body!.getReader();
        const decoder = new TextDecoder();
        let pending = '';
        while (!pending.includes('\n\n')) {
          const chunk = await reader.read();
          if (chunk.done) break;
          pending += decoder.decode(chunk.value, { stream: true });
        }
        const clientId = pending.match(/clientId=([0-9a-f-]+)/)?.[1];
        assert.ok(clientId);
        const post = () => fetch(`${base}/messages?clientId=${clientId}`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
        });
        return { post };
      };
      const first = await open('Bearer test-secret-key');
      const second = await open(`Bearer ${alias}`);
      let limited = 0;
      for (let i = 0; i < 60; i++) {
        const res = await first.post();
        assert.equal(res.status, 202);
        await res.body?.cancel();
      }
      const blocked = await first.post();
      limited = blocked.status;
      await blocked.body?.cancel();
      const other = await second.post();
      await other.body?.cancel();
      assert.equal(limited, 429);
      assert.equal(other.status, 202);
    } finally {
      for (const controller of controllers) controller.abort();
      await stopServer(proc);
    }
  });

  it('accepts a bearer with surrounding whitespace as the same credential', async () => {
    const port = await getFreePort();
    const proc = startIndex(port, {});
    const base = `http://127.0.0.1:${port}`;
    const controller = new AbortController();
    try {
      await waitForReady(`${base}/health`);
      const stream = await fetch(`${base}/sse`, {
        headers: { Authorization: 'Bearer test-secret-key' },
        signal: controller.signal,
      });
      const reader = stream.body!.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      while (!pending.includes('\n\n')) {
        const chunk = await reader.read();
        pending += decoder.decode(chunk.value, { stream: true });
      }
      const clientId = pending.match(/clientId=([0-9a-f-]+)/)?.[1];
      const posted = await fetch(`${base}/messages?clientId=${clientId}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer  test-secret-key  ', 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      assert.equal(posted.status, 202);
      const again = await fetch(`${base}/messages?clientId=${clientId}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer test-secret-key', 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      });
      assert.equal(again.status, 202);
    } finally {
      controller.abort();
      await stopServer(proc);
    }
  });

  it('drops a slow client once the write buffer exceeds the cap', async () => {
    const port = await getFreePort();
    const proc = startIndex(port, { QUILL_SSE_MAX_BUFFER: '64', QUILL_SSE_HEARTBEAT_MS: '60000' });
    const base = `http://127.0.0.1:${port}`;
    const controller = new AbortController();
    try {
      await waitForReady(`${base}/health`);
      const headers = { Authorization: 'Bearer test-secret-key' };
      const stream = await fetch(`${base}/sse`, { headers, signal: controller.signal });
      assert.equal(stream.status, 200);
      const reader = stream.body!.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      while (!pending.includes('\n\n')) {
        const chunk = await reader.read();
        if (chunk.done) break;
        pending += decoder.decode(chunk.value, { stream: true });
      }
      const clientId = pending.match(/clientId=([0-9a-f-]+)/)?.[1];
      assert.ok(clientId);
      const posted = await fetch(`${base}/messages?clientId=${clientId}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/list' }),
      });
      assert.equal(posted.status, 202);
      await posted.body?.cancel();
      // Leave the SSE body unread so the catalog frame queues past the cap.
      await new Promise((resolve) => setTimeout(resolve, 500));
      const again = await fetch(`${base}/messages?clientId=${clientId}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      });
      assert.equal(again.status, 404);
    } finally {
      controller.abort();
      await stopServer(proc);
    }
  });

  it('rejects a chunked body over 1 MiB without a Content-Length', async () => {
    const port = await getFreePort();
    const proc = startIndex(port, {});
    const base = `http://127.0.0.1:${port}`;
    const controller = new AbortController();
    try {
      await waitForReady(`${base}/health`);
      const headers = { Authorization: 'Bearer test-secret-key' };
      const stream = await fetch(`${base}/sse`, { headers, signal: controller.signal });
      const reader = stream.body!.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      while (!pending.includes('\n\n')) {
        const chunk = await reader.read();
        pending += decoder.decode(chunk.value, { stream: true });
      }
      const clientId = pending.match(/clientId=([0-9a-f-]+)/)?.[1];
      const status = await new Promise<number>((resolve, reject) => {
        const req = httpRequest({
          host: '127.0.0.1',
          port,
          method: 'POST',
          path: `/messages?clientId=${clientId}`,
          headers: { Authorization: headers.Authorization, 'Content-Type': 'application/json' },
        }, (res: IncomingMessage) => {
          res.resume();
          res.on('end', () => resolve(res.statusCode ?? 0));
        });
        req.on('error', reject);
        req.write('{"pad":"');
        req.write('x'.repeat(1024 * 1024 + 64));
        req.end('"}');
      });
      assert.equal(status, 413);
      const listed = await fetch(`${base}/messages?clientId=${clientId}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/list' }),
      });
      assert.equal(listed.status, 202);
    } finally {
      controller.abort();
      await stopServer(proc);
    }
  });
});
