/**
 * HTTP Utility Tests — Quill
 *
 * Hermetic: spins up a local node:http server instead of hitting httpbin.org,
 * so the suite is offline-stable and immune to third-party outages.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { httpGet } from '../../../src/utils/http.js';
import { withIngestionArtifactCapture, getIngestionArtifacts } from '../../claims/artifact-capture.js';

let server: Server;
let baseUrl: string;

before(async () => {
  server = createServer((req, res) => {
    const url = req.url ?? '/';
    if (url.startsWith('/json')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ slideshow: { title: 'Test Slideshow' } }));
    } else if (url === '/status/404') {
      res.writeHead(404);
      res.end('Not Found');
    } else if (url === '/status/204' || url === '/status/200-empty') {
      res.writeHead(url === '/status/204' ? 204 : 200, { 'Content-Type': 'text/plain' });
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

  it('captures response artifact evidence only inside an active ingestion capture', async () => {
    const outside = await httpGet(`${baseUrl}/json`, { timeoutMs: 5000 });
    assert.equal(outside.statusCode, 200);
    assert.equal(getIngestionArtifacts().length, 0);

    await withIngestionArtifactCapture(async () => {
      const resp = await httpGet(`${baseUrl}/json?token=secret`, { timeoutMs: 5000 });
      assert.equal(resp.statusCode, 200);
      const [artifact] = getIngestionArtifacts();
      assert.ok(artifact);
      assert.equal(artifact.sha256.length, 64);
      assert.equal(artifact.statusCode, 200);
      assert.equal(artifact.url, `${baseUrl}/json`);
      assert.equal(artifact.urlRedacted, true);
      assert.equal(artifact.mediaType, 'application/json');
      assert.equal(artifact.byteLength, Buffer.byteLength(resp.body, 'utf8'));
    });
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

  it('captures a fully read empty body and its digest', async () => {
    await withIngestionArtifactCapture(async () => {
      const resp = await httpGet(`${baseUrl}/status/200-empty`, { timeoutMs: 5000 });
      assert.strictEqual(resp.statusCode, 200);
      assert.strictEqual(resp.body, '');
      const [artifact] = getIngestionArtifacts();
      assert.ok(artifact);
      assert.equal(artifact.bodyCapture, 'complete-http-client-body');
      assert.equal(artifact.byteLength, 0);
      assert.equal(artifact.sha256, createHash('sha256').update('', 'utf8').digest('hex'));
    });
  });

  it('should handle empty responses', async () => {
    const resp = await httpGet(`${baseUrl}/status/204`, { timeoutMs: 5000 });
    assert.strictEqual(resp.statusCode, 204);
    assert.strictEqual(resp.body, '');
  });
});
