/**
 * Bounds for the live endpoint probe.
 *
 * A handler that never writes a response must fail inside the per-request
 * timeout, name the URL, and stop after the attempt cap. A 4xx is an answer,
 * not a hang, and is not retried.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer, type Server, type Socket } from 'node:http';
import { fileURLToPath } from 'node:url';
import { probeEndpoint, LiveProbeError } from '../live-probe.js';

function repoRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, '.github', 'workflows', 'live-data-check.yml'))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error('repo root not found from live-probe.test.ts');
}

async function listen(handler: (reqCount: () => number) => (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void): Promise<{
  server: Server;
  url: string;
  hits: () => number;
  close: () => Promise<void>;
}> {
  let hits = 0;
  const sockets = new Set<Socket>();
  const server = createServer(handler(() => hits));
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.on('request', () => { hits += 1; });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  return {
    server,
    url: `http://127.0.0.1:${addr.port}/probe`,
    hits: () => hits,
    close: () => new Promise((resolve) => {
      for (const socket of sockets) socket.destroy();
      server.close(() => resolve());
    }),
  };
}

describe('probeEndpoint', () => {
  const closers: Array<() => Promise<void>> = [];
  after(async () => {
    await Promise.all(closers.splice(0).map((close) => close()));
  });

  it('times out a silent endpoint, names the URL, and stops at the attempt cap', async () => {
    const endpoint = await listen(() => () => {
      // Never write a response. The probe must not wait on this.
    });
    closers.push(endpoint.close);
    const timeoutMs = 200;
    const maxAttempts = 2;
    await assert.rejects(
      () => probeEndpoint(endpoint.url, { timeoutMs, maxAttempts }),
      (err: unknown) => {
        assert.ok(err instanceof LiveProbeError);
        assert.equal(err.timedOut, true);
        assert.equal(err.attempts, maxAttempts);
        assert.match(err.message, new RegExp(`timed out after ${timeoutMs}ms waiting on ${endpoint.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
        return true;
      },
    );
    assert.equal(endpoint.hits(), maxAttempts);
  });

  it('does not open a third connection when the cap is 2', async () => {
    const endpoint = await listen(() => () => {});
    closers.push(endpoint.close);
    await assert.rejects(() => probeEndpoint(endpoint.url, { timeoutMs: 150, maxAttempts: 2 }));
    assert.equal(endpoint.hits(), 2);
  });

  it('retries a 500 once and then fails naming the URL', async () => {
    const endpoint = await listen(() => (_req, res) => {
      res.writeHead(500);
      res.end('nope');
    });
    closers.push(endpoint.close);
    await assert.rejects(
      () => probeEndpoint(endpoint.url, { timeoutMs: 1000, maxAttempts: 2 }),
      (err: unknown) => {
        assert.ok(err instanceof LiveProbeError);
        assert.equal(err.timedOut, false);
        assert.equal(err.attempts, 2);
        assert.match(err.message, /HTTP 500/);
        assert.match(err.message, /waiting on|from /);
        assert.ok(err.message.includes(endpoint.url));
        return true;
      },
    );
    assert.equal(endpoint.hits(), 2);
  });

  it('accepts a 200 on the retry after one 500', async () => {
    let n = 0;
    const endpoint = await listen(() => (_req, res) => {
      n += 1;
      if (n === 1) {
        res.writeHead(500);
        res.end('try again');
        return;
      }
      res.writeHead(200);
      res.end('ok');
    });
    closers.push(endpoint.close);
    const result = await probeEndpoint(endpoint.url, { timeoutMs: 1000, maxAttempts: 2 });
    assert.equal(result.status, 200);
    assert.equal(result.url, endpoint.url);
    assert.equal(endpoint.hits(), 2);
  });

  it('does not retry a 404 — the endpoint answered', async () => {
    const endpoint = await listen(() => (_req, res) => {
      res.writeHead(404);
      res.end('missing');
    });
    closers.push(endpoint.close);
    const result = await probeEndpoint(endpoint.url, { timeoutMs: 1000, maxAttempts: 2 });
    assert.equal(result.status, 404);
    assert.equal(endpoint.hits(), 1);
  });

  it('rejects a non-positive attempt cap before any request', async () => {
    await assert.rejects(
      () => probeEndpoint('http://127.0.0.1:9/not-called', { maxAttempts: 0 }),
      (err: unknown) => {
        assert.ok(err instanceof LiveProbeError);
        assert.match(err.message, /retry cap/);
        assert.match(err.message, /127\.0\.0\.1:9/);
        return true;
      },
    );
  });
});

describe('live data check workflow bounds', () => {
  const workflow = fs.readFileSync(
    path.join(repoRoot(), '.github', 'workflows', 'live-data-check.yml'),
    'utf8',
  );
  const smoke = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'live', 'endpoint-smoke.test.ts'),
    'utf8',
  );

  it('keeps the arc-maplespike runner', () => {
    assert.match(workflow, /runs-on:\s*arc-maplespike/);
    assert.doesNotMatch(workflow, /ubuntu-latest/);
  });

  it('caps the smoke step well under the 20 minute job limit', () => {
    assert.match(workflow, /timeout-minutes:\s*20/);
    const stepAt = workflow.indexOf('name: Run live endpoint smoke tests');
    assert.ok(stepAt > 0, 'smoke step missing');
    const window = workflow.slice(stepAt, stepAt + 800);
    const stepTimeout = window.match(/timeout-minutes:\s*(\d+)/);
    assert.ok(stepTimeout, 'smoke step has no timeout-minutes');
    const minutes = Number(stepTimeout[1]);
    assert.ok(minutes > 0 && minutes < 20, `smoke step timeout ${minutes} must be under the 20 minute job limit`);
  });

  it('names the in-flight endpoint when the step times out and does not call runModule', () => {
    assert.match(workflow, /timed out waiting on/);
    assert.match(workflow, /LIVE_SMOKE_ENDPOINT_FILE/);
    assert.match(workflow, /--test-timeout=/);
    assert.match(workflow, /--test-force-exit/);
    assert.match(workflow, /--test-concurrency=1/);
    assert.doesNotMatch(smoke, /runModule\s*\(/);
    assert.match(smoke, /probeEndpoint\s*\(/);
  });
});
