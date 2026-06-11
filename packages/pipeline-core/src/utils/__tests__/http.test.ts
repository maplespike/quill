/**
 * HTTP Utility Tests — MapleSpike Pipeline
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { httpGet } from '../../../dist/utils/http.js';

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
    const json = await resp.json() as any;
    assert.ok(typeof json === 'object' && json !== null);
    assert.ok('slideshow' in json);
  });

  it('should handle 404 errors gracefully', async () => {
    const resp = await httpGet('https://httpbin.org/status/404', {
      timeoutMs: 5000,
    });
    assert.strictEqual(resp.statusCode, 404);
  });

  it('should handle empty responses', async () => {
    const resp = await httpGet('https://httpbin.org/status/204', {
      timeoutMs: 5000,
    });
    assert.strictEqual(resp.statusCode, 204);
    assert.strictEqual(resp.body, '');
  });
});