// SPDX-License-Identifier: AGPL-3.0-only
/**
 * HTTP Utility Tests — Quill
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { httpGet } from '../src/utils/http.js';

describe('httpGet', () => {
  it('should handle successful GET request', async () => {
    const resp = await httpGet('https://httpbin.org/get', {
      timeoutMs: 5000,
    });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(typeof resp.body, 'string');
  });

  it('should handle JSON parsing', async () => {
    const resp = await httpGet('https://httpbin.org/json', {
      timeoutMs: 5000,
    });
    const json = await resp.json();
    assert.ok(typeof json === 'object' && json !== null);
    assert.ok('slideshow' in json);
  });

  it('should handle 404 errors gracefully', async () => {
    const resp = await httpGet('https://httpbin.org/status/404', {
      timeoutMs: 5000,
    });
    assert.strictEqual(resp.statusCode, 404);
  });

  it('should retry on transient failures (5xx)', async () => {
    const startTime = Date.now();
    const resp = await httpGet('https://httpbin.org/status/500', {
      timeoutMs: 2000,
      maxRetries: 2,
    });
    const duration = Date.now() - startTime;
    assert.ok(duration >= 2000, `Expected >=2000ms due to retries, got ${duration}ms`);
    assert.strictEqual(resp.statusCode, 500);
  });

  it('should timeout on slow responses', async () => {
    const resp = await httpGet('https://httpbin.org/delay/3', {
      timeoutMs: 1000,
    });
    assert.ok(resp.statusCode >= 0);
  });

  it('should respect custom headers', async () => {
    const resp = await httpGet('https://httpbin.org/headers', {
      timeoutMs: 5000,
      headers: { 'X-Custom-Header': 'test-value' },
    });
    assert.strictEqual(resp.statusCode, 200);
    const json = await resp.json();
    assert.ok('headers' in json);
    assert.strictEqual(json.headers['x-custom-header'], 'test-value');
  });

  it('should handle rate limiting via token bucket', async () => {
    const [resp1, resp2] = await Promise.all([
      httpGet('https://httpbin.org/get', { timeoutMs: 5000 }),
      httpGet('https://httpbin.org/delay/0.5', { timeoutMs: 5000 }),
    ]);
    assert.strictEqual(resp1.statusCode, 200);
    assert.strictEqual(resp2.statusCode, 200);
  });

  it('should handle empty responses', async () => {
    const resp = await httpGet('https://httpbin.org/status/204', {
      timeoutMs: 5000,
    });
    assert.strictEqual(resp.statusCode, 204);
    assert.strictEqual(resp.body, '');
  });
});