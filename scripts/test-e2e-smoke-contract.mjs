/**
 * scripts/e2e-smoke.sh must follow the API the servers actually serve.
 *
 * /v1/modules is gone. GET /v1/openapi.json wraps the spec in
 * { success, data: { openapi, paths } }. quill-mcp serves GET /health,
 * not /healthz.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'e2e-smoke.sh');

function listen(onRequest) {
  const hits = [];
  const server = createServer((req, res) => {
    hits.push(req.url ?? '');
    onRequest(req, res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        base: `http://127.0.0.1:${addr.port}`,
        hits,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

function runSmoke(urls) {
  return new Promise((resolve) => {
    const child = spawn('bash', [
      SCRIPT,
      '--mode=local',
      '--timeout=3',
      `--api=${urls.api}`,
      `--mcp=${urls.mcp}`,
      `--portal=${urls.portal}`,
    ], { cwd: ROOT });
    let out = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
    }, 20_000);
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { out += chunk; });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, out });
    });
  });
}

test('the script does not call the removed routes', () => {
  const src = readFileSync(SCRIPT, 'utf8');
  assert.equal(src.includes('/v1/modules'), false);
  assert.equal(src.includes('/healthz'), false);
  assert.match(src, /j\.data/);
  assert.match(src, /\$MCP_URL\/health/);
});

test('a wrapped OpenAPI spec and MCP /health pass', async () => {
  const api = await listen((req, res) => {
    if ((req.url ?? '').startsWith('/v1/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    if ((req.url ?? '').startsWith('/v1/openapi.json')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: { openapi: '3.1.0', paths: { '/v1/health': {} } },
      }));
      return;
    }
    res.writeHead(404);
    res.end('missing');
  });
  const portal = await listen((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><title>MapleSpike</title></html>');
  });
  const mcp = await listen((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', tools: 1 }));
      return;
    }
    res.writeHead(404);
    res.end('missing');
  });
  try {
    const result = await runSmoke({ api: api.base, mcp: mcp.base, portal: portal.base });
    assert.equal(result.code, 0, result.out);
    assert.equal(api.hits.some((url) => url.startsWith('/v1/modules')), false);
    assert.equal(mcp.hits.includes('/healthz'), false);
    assert.ok(mcp.hits.includes('/health'));
    assert.ok(api.hits.some((url) => url.startsWith('/v1/openapi.json')));
  } finally {
    await api.close();
    await portal.close();
    await mcp.close();
  }
});

test('a top-level openapi document is not the current shape', async () => {
  const api = await listen((req, res) => {
    if ((req.url ?? '').startsWith('/v1/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ openapi: '3.1.0', paths: { '/v1/health': {} } }));
  });
  const portal = await listen((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html>MapleSpike</html>');
  });
  const mcp = await listen((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  });
  try {
    const result = await runSmoke({ api: api.base, mcp: mcp.base, portal: portal.base });
    assert.notEqual(result.code, 0);
    assert.match(result.out, /openapi/);
  } finally {
    await api.close();
    await portal.close();
    await mcp.close();
  }
});

test('MCP /healthz is not accepted in place of /health', async () => {
  const api = await listen((req, res) => {
    if ((req.url ?? '').startsWith('/v1/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: { openapi: '3.1.0', paths: {} },
    }));
  });
  const portal = await listen((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html>MapleSpike</html>');
  });
  const mcp = await listen((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200);
      res.end('ok');
      return;
    }
    res.writeHead(404);
    res.end('missing');
  });
  try {
    const result = await runSmoke({ api: api.base, mcp: mcp.base, portal: portal.base });
    assert.notEqual(result.code, 0, result.out);
    assert.match(result.out, /MCP/);
    assert.equal(mcp.hits.includes('/healthz'), false);
    assert.ok(mcp.hits.includes('/health'));
  } finally {
    await api.close();
    await portal.close();
    await mcp.close();
  }
});
