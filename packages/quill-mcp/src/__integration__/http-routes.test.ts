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
 * The spawn chain is `pnpm -> pnpm -> tsx -> node`, and `proc.pid` is only the
 * outer pnpm. Killing just that leaves the real server alive — still listening
 * and answering /health — with the stdio pipes open, and those open pipes keep
 * the test process's event loop alive, so `node --test` never exits. Measured
 * 2026-10-08: an integration job squatted a self-hosted runner until the
 * 60-minute job timeout while the orphaned server answered HTTP 200 in 2 ms.
 * `detached: true` puts the whole chain in its own process group, so a single
 * negative-PID signal reaches every member.
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
    const pkgRoot = new URL('../../..', import.meta.url).pathname;

    // Spawn via `pnpm --filter ... exec tsx` so pnpm resolves tsx from
    // the package's own devDependencies regardless of how node_modules is
    // laid out (hoisted vs isolated). Avoids ENOENTs from PATH/npx lookup.
    proc = spawn(
      'pnpm',
      ['--filter', '@maplespike/quill-mcp', 'exec', 'tsx', 'src/index.ts'],
      {
        cwd: pkgRoot,
        env: {
          ...process.env,
          PORT: String(port),
          NODE_ENV: 'test',
          QUILL_API_KEY: 'test-secret-key', // non-dev key so auth is enforced
          X402_ENABLED: 'false',
          QUOTA_ENABLED: 'false',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        // Own process group: the spawn chain is pnpm -> pnpm -> tsx -> node, so
        // teardown must signal the GROUP (see stopServer) — killing only
        // proc.pid orphans the real server and the test process never exits.
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
});
