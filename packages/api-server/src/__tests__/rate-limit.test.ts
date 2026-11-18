// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit, enforceRateLimit, BURST_LIMITS } from '../rate-limit.js';
import { MemoryStorage } from '../storage.js';
import type { Tier } from '../types.js';

describe('Rate Limiting', () => {
  it('checkRateLimit allows requests under the limit', () => {
    const result = checkRateLimit('test-tenant', 5, 60_000);
    assert.ok(result.allowed);
    assert.equal(result.remaining, 4);
  });

  it('checkRateLimit blocks when burst limit exceeded', () => {
    const key = `test-block-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, 5, 60_000);
    }
    const result = checkRateLimit(key, 5, 60_000);
    assert.equal(result.allowed, false);
    assert.equal(result.remaining, 0);
  });

  it('BURST_LIMITS has reasonable values for all tiers', () => {
    const tiers: Tier[] = ['free', 'pro', 'business', 'enterprise', 'internal'];
    for (const tier of tiers) {
      assert.ok(BURST_LIMITS[tier] > 0, `Burst limit missing for ${tier}`);
      assert.ok(BURST_LIMITS[tier] <= 2000, `Burst limit too high for ${tier}`);
    }
  });

  it('enforceRateLimit enforces daily quota', async () => {
    const db = new MemoryStorage();
    const tenantId = 'daily-test';
    const date = new Date().toISOString().split('T')[0];
    const yearMonth = date.substring(0, 7);

    // Simulate a free tier that has already hit its daily limit
    for (let i = 0; i < 35; i++) {
      await db.incrementUsage(tenantId, date, yearMonth);
    }

    const result = await enforceRateLimit(db, tenantId, 'free', true, tenantId);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'daily');
    assert.ok(result.resetTime > Date.now());
  });

  it('enforceRateLimit enforces monthly quota', async () => {
    // Use a mock storage so we can hit the monthly cap without first
    // exhausting the much smaller daily cap.
    const db = {
      getDailyUsage: async () => 0,
      getMonthlyUsage: async () => 1000,
      incrementUsage: async () => {},
    } as unknown as import('../storage.js').MemoryStorage;

    const result = await enforceRateLimit(db, 'monthly-test', 'free', true, 'monthly-test');
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'monthly');
    assert.ok(result.resetTime > Date.now());
  });

  it('enforceRateLimit allows requests within quota', async () => {
    const db = new MemoryStorage();
    const tenantId = 'allow-test';
    const result = await enforceRateLimit(db, tenantId, 'pro', true, tenantId);
    assert.equal(result.allowed, true);
    assert.equal(result.reason, undefined);
    assert.ok(result.remaining >= 0);
  });

  it('enforceRateLimit only applies burst limits to anonymous traffic', async () => {
    const db = new MemoryStorage();
    const key = 'anon:127.0.0.1';
    const result = await enforceRateLimit(db, 'anon', 'free', false, key);
    assert.equal(result.allowed, true);
    assert.equal(result.reason, undefined);
  });
});
