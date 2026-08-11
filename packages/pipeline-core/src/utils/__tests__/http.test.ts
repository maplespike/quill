/**
 * HTTP Utility Tests — MapleSpike Pipeline
 *
 * Hermetic: spins up a local node:http server instead of hitting httpbin.org,
 * so the suite is offline-stable and immune to third-party outages.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { httpGet } from '../../../src/utils/http.js';

let server: Server;
let baseUrl: string;

before(async () => {
  server = createServer((req, res) => {
    const url = req.url ?? '/';
    if (url === '/json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ slideshow: { title: 'Test Slideshow' } }));
    } else if (url === '/status/404') {
      res.writeHead(404);
      res.end('Not Found');
    } else if (url === '/status/204') {
      res.writeHead(204);
      res.end();
    } else {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('hello world');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object', 'server should be listening');
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(() => {
  server.close();
});

describe('httpGet', () => {
  it('should handle successful GET request', async () => {
    const resp = await httpGet(`${baseUrl}/get`, {
      timeoutMs: 5000,
    });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(typeof resp.body, 'string');
  });

  it('should handle JSON parsing', async () => {
    const resp = await httpGet(`${baseUrl}/json`, {
      timeoutMs: 5000,
    });
    const json = await resp.json() as any;
    assert.ok(typeof json === 'object' && json !== null);
    assert.ok('slideshow' in json);
  });

  it('should handle 404 errors gracefully', async () => {
    const resp = await httpGet(`${baseUrl}/status/404`, {
      timeoutMs: 5000,
    });
    assert.strictEqual(resp.statusCode, 404);
  });

  it('should handle empty responses', async () => {
    const resp = await httpGet(`${baseUrl}/status/204`, {
      timeoutMs: 5000,
    });
    assert.strictEqual(resp.statusCode, 204);
    assert.strictEqual(resp.body, '');
  });
});
