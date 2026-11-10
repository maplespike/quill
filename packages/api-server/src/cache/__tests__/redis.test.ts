// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { RedisClient } from '../redis.js';

describe('RedisClient (cache-aside logic)', () => {
  let client: RedisClient;

  before(() => {
    client = new RedisClient();
  });

  after(async () => {
    await client.disconnect();
  });

  it('getCached returns miss when client is not connected', async () => {
    const fetchFn = mock.fn(async () => ({ data: 'fresh' }));
    const result = await client.getCached('test-key', 60, fetchFn);

    assert.equal(result.cacheStatus, 'bypass');
    assert.deepEqual(result.value, { data: 'fresh' });
    assert.equal(fetchFn.mock.callCount(), 1);
  });

  it('getCached calls fetchFn on cache miss', async () => {
    // Simulate a connected client with internal mock
    const c = new RedisClient();
    (c as any).connected = true;
    (c as any).client = {
      get: mock.fn(async () => null),
      setex: mock.fn(async () => 'OK'),
      set: mock.fn(async () => 'OK'),
      quit: mock.fn(async () => 'OK'),
      disconnect: mock.fn(),
    };

    const fetchFn = mock.fn(async () => 'computed-value');
    const result = await c.getCached('miss-key', 30, fetchFn);

    assert.equal(result.cacheStatus, 'miss');
    assert.equal(result.value, 'computed-value');
    assert.equal(fetchFn.mock.callCount(), 1);

    await c.disconnect();
  });

  it('getCached returns cached value on cache hit', async () => {
    const c = new RedisClient();
    const mockStore = new Map<string, string>();
    mockStore.set('hit-key', JSON.stringify({ value: 'stored-value' }));

    (c as any).connected = true;
    (c as any).client = {
      get: mock.fn(async (key: string) => mockStore.get(key) ?? null),
      setex: mock.fn(async () => 'OK'),
      set: mock.fn(async () => 'OK'),
      quit: mock.fn(async () => 'OK'),
      disconnect: mock.fn(),
    };

    const fetchFn = mock.fn(async () => 'should-not-be-called');
    const result = await c.getCached('hit-key', 30, fetchFn);

    assert.equal(result.cacheStatus, 'hit');
    assert.equal(result.value, 'stored-value');
    assert.equal(fetchFn.mock.callCount(), 0);

    await c.disconnect();
  });

  it('getCached falls back to fetchFn on Redis error', async () => {
    const c = new RedisClient();
    (c as any).connected = true;
    (c as any).client = {
      get: mock.fn(async () => { throw new Error('Redis timeout'); }),
      setex: mock.fn(async () => 'OK'),
      set: mock.fn(async () => 'OK'),
      quit: mock.fn(async () => 'OK'),
      disconnect: mock.fn(),
    };

    const fetchFn = mock.fn(async () => 'fallback-data');
    const result = await c.getCached('error-key', 30, fetchFn);

    // Even though Redis threw, we should get the fresh data
    assert.equal(result.value, 'fallback-data');
    assert.equal(fetchFn.mock.callCount(), 1);

    await c.disconnect();
  });

  it('del works when not connected (no-op)', async () => {
    // Should not throw
    await client.del('nonexistent-key');
  });

  it('get returns null when not connected', async () => {
    const val = await client.get('any-key');
    assert.equal(val, null);
  });

  it('set is a no-op when not connected', async () => {
    // Should not throw
    await client.set('any-key', 'value', 60);
  });
});
