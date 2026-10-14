/**
 * HTTP route smoke test for Quill MCP server (index.ts SSE mode).
 *
 * Boots `src/index.ts` as a child process with `PORT=<free-port>` + `NODE_ENV=test`,
 * then issues real HTTP requests against the documented routes to lock in
 * the green state of:
 *
 *   GET  /                 → 301 → /sse  (root redirect)
 *   GET  /health           → 200 {status, tools}
 *   GET  /sse              → 401 (no auth in test mode — auth required)
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

const SKIP = process.env.SKIP_NETWORK_TESTS === '1';
const SKIP_REASON = 'SKIP_NETWORK_TESTS=1';

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

async function waitForReady(url: string, timeoutMs = 10_000): Promise<void> {
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

  it('GET /sse returns 401 when no auth provided', async () => {
    const res = await fetch(`${baseUrl}/sse`);
    assert.equal(res.status, 401);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.error, 'Unauthorized');
  });

  it('POST /messages returns 404 without SSE clientId', async () => {
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      assert.equal(listed.result.tools.length, 184);
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
