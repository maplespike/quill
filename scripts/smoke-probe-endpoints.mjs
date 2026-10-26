#!/usr/bin/env node
/**
 * Smoke the health paths the chart probes call.
 *
 * Portal: start server.py and GET /health.
 * API and MCP: the package integration suites call /v1/health and /health.
 * This script still checks those routes when a base URL is set
 * (SMOKE_API_URL, SMOKE_MCP_URL, SMOKE_SEARCH_URL), and always checks portal.
 *
 * A non-200 or a body that is not the cheap health document fails the run.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const portalServer = fileURLToPath(new URL('../packages/portal/server.py', import.meta.url));

function freePort() {
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

async function getJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

function assertHealth(name, result) {
  if (result.status !== 200) {
    console.error(`${name}: expected 200, got ${result.status}`);
    process.exitCode = 1;
    return;
  }
  const status = result.body && typeof result.body === 'object' ? result.body.status : undefined;
  if (status !== 'ok') {
    console.error(`${name}: expected {"status":"ok"}, got ${JSON.stringify(result.body).slice(0, 200)}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${name}: 200 {"status":"ok"}`);
}

async function smokePortal() {
  const dir = mkdtempSync(join(tmpdir(), 'quill-probe-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>probe</title>');
  const port = await freePort();
  const proc = spawn('python3', [portalServer], {
    env: { ...process.env, PORT: String(port), PORTAL_STATIC_DIR: dir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    const deadline = Date.now() + 10_000;
    let ready = false;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${base}/health`);
        if (res.status === 200) {
          ready = true;
          break;
        }
      } catch {
        /* process still binding */
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!ready) {
      console.error('portal: /health did not answer');
      process.exitCode = 1;
      return;
    }
    assertHealth('portal /health', await getJson(`${base}/health`));
    const home = await fetch(`${base}/`);
    if (home.status !== 200) {
      console.error(`portal /: expected 200, got ${home.status}`);
      process.exitCode = 1;
    }
  } finally {
    proc.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  }
}

async function smokeOptional(name, base) {
  if (!base) return;
  const url = base.replace(/\/$/, '') + (name === 'api' ? '/v1/health' : '/health');
  try {
    assertHealth(`${name} ${url}`, await getJson(url));
  } catch (err) {
    console.error(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

await smokePortal();
await smokeOptional('api', process.env.SMOKE_API_URL);
await smokeOptional('mcp', process.env.SMOKE_MCP_URL);
await smokeOptional('search', process.env.SMOKE_SEARCH_URL);

if (process.exitCode) process.exit(process.exitCode);
