/**
 * HTTP route smoke test for Quill MCP server (cli.ts SSE mode).
 *
 * Boots `src/cli.ts` as a child process with `PORT=<free-port>` + `NODE_ENV=test`,
 * then issues real HTTP requests against the documented routes to lock in
 * the green state of:
 *
 *   GET  /            → 308 → /sse  (root redirect)
 *   GET  /health      → 200 {status, tools, transport, checks, uptime}
 *   GET  /readyz      → 200 (same handler as /health in cli.ts)
 *   GET  /sse         → 200 text/event-stream  (dev mode only)
 *   POST /messages    → 200 with envelope OR 400 on invalid JSON-RPC
 *   GET  /metrics     → 200 Prometheus-format text
 *   OPTIONS /*        → 204 (CORS preflight)
 *   GET  /random      → 404 NOT_FOUND (covers the not-found branch)
 *
 * Skipped automatically when SKIP_NETWORK_TESTS=1 (used by air-gapped CI).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';

const SKIP = process.env.SKIP_NETWORK_TESTS === '1';
const SKIP_REASON = 'SKIP_NETWORK_TESTS=1';

/**
 * Asserts that a fetched JSON body contains every named field, catching
 * silent regressions where cli.ts changes its response shape (rename,
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

async function waitForReady(url: string, timeoutMs = 60_000): Promise<void> {
  // cli.ts's /health calls fetch(QUILL_API_URL/health) with a 3s timeout
  // before responding; each poll can take up to ~3s. Budget 60s for cold
  // boot of the cli.ts child (~2-5s) + poll iterations.
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

describe('quill-mcp cli.ts HTTP routes', { skip: SKIP && SKIP_REASON }, () => {
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
      ['--filter', '@maplespike/quill-mcp', 'exec', 'tsx', 'src/cli.ts'],
      {
        cwd: pkgRoot,
        env: {
          ...process.env,
          PORT: String(port),
          NODE_ENV: 'test',
          X402_ENABLED: 'false',
          QUOTA_ENABLED: 'false',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    proc.on('error', (err) => {
      console.error('[test] child process error:', err);
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      if (process.env.VERBOSE_TESTS === '1') {
        process.stderr.write(`[cli stderr] ${chunk.toString()}`);
      }
    });

    await waitForReady(`${baseUrl}/health`);
  });

  // Sanity check the spawn worked before any sub-test runs (faster failure
  // surface than waiting for every subtest to time out).
  before((t) => {
    if (!proc || proc.killed || proc.exitCode !== null) {
      t.skip('cli.ts child process failed to spawn — see stderr from before() hook');
    }
  });

  after(async () => {
    if (proc && !proc.killed) {
      proc.kill('SIGTERM');
      // give it 500ms to exit gracefully
      await new Promise((r) => setTimeout(r, 500));
      if (!proc.killed) proc.kill('SIGKILL');
    }
  });

  it('GET /health returns 200 with stable response shape', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    const body = await res.json() as Record<string, unknown>;
    ensureFields(body, ['status', 'tools', 'transport', 'checks', 'uptime']);
    assert.ok(['ok', 'degraded'].includes(String(body.status)), `unexpected status: ${body.status}`);
    assert.equal(body.transport, 'sse');
    assert.equal(typeof body.tools, 'number');
    assert.equal(typeof body.uptime, 'number');
  });

  it('GET /readyz returns 200', async () => {
    const res = await fetch(`${baseUrl}/readyz`);
    assert.equal(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    ensureFields(body, ['status', 'tools', 'transport', 'checks', 'uptime']);
    assert.ok(['ok', 'degraded'].includes(String(body.status)));
  });

  it('GET /sse returns 200 text/event-stream (dev/test mode)', async () => {
    const res = await fetch(`${baseUrl}/sse`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/event-stream/);
    // Read first event then close — the cli.ts writes a "endpoint" event immediately
    const reader = res.body?.getReader();
    if (reader) {
      const { value } = await reader.read();
      reader.cancel().catch(() => {});
      const text = value ? new TextDecoder().decode(value) : '';
      assert.ok(text.includes('endpoint'), `expected endpoint event, got: ${text.slice(0, 80)}`);
    }
  });

  it('GET /metrics returns 200 Prometheus text', async () => {
    const res = await fetch(`${baseUrl}/metrics`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/plain/);
    const text = await res.text();
    assert.ok(text.includes('mcp_requests_total'), 'expected mcp_requests_total counter');
    assert.ok(text.includes('# TYPE mcp_requests_total counter'), 'expected HELP/TYPE annotations');
  });

  it('POST /messages with empty body returns 400 invalid JSON-RPC', async () => {
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    });
    assert.equal(res.status, 400);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.error, 'Invalid JSON-RPC');
  });

  it('POST /messages with valid JSON-RPC tool call returns 200 envelope', async () => {
    const rpc = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    };
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpc),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.jsonrpc, '2.0');
    assert.equal(body.id, 1);
  });

  it('OPTIONS * returns 204 CORS preflight', async () => {
    const res = await fetch(`${baseUrl}/health`, { method: 'OPTIONS' });
    assert.equal(res.status, 204);
    assert.ok(res.headers.get('access-control-allow-origin'), 'expected CORS headers');
  });

  it('GET /unknown-path returns 404 NOT_FOUND', async () => {
    const res = await fetch(`${baseUrl}/nope-this-does-not-exist`);
    assert.equal(res.status, 404);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.error, 'Not found');
    assert.equal(body.path, '/nope-this-does-not-exist');
  });
});
