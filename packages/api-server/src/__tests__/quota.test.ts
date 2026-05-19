import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkRateLimit,
  checkKeyRateLimit,
  resetTenantRateLimit,
  resetKeyRateLimit,
  getRateLimitStatus,
  getQuotaResetTime,
} from '../rate-limit.js';
import { MemoryStorage, MemoryCache } from '../storage.js';
import { addRateLimitHeaders, addQuotaHeaders, addUsageHeaders } from '../response.js';

describe('Rate Limiting', () => {
  beforeEach(() => {
    resetTenantRateLimit('test-tenant');
    resetKeyRateLimit('test-key');
  });

  it('allows requests within limit', () => {
    const result = checkRateLimit('test-tenant', 10, 60_000);
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 9);
    assert.equal(result.limit, 10);
  });

  it('blocks requests after limit exceeded', () => {
    const limit = 3;
    for (let i = 0; i < limit; i++) {
      checkRateLimit('test-tenant', limit, 60_000);
    }
    const result = checkRateLimit('test-tenant', limit, 60_000);
    assert.equal(result.allowed, false);
    assert.equal(result.remaining, 0);
  });

  it('tracks per-key rate limits separately', () => {
    const keyResult = checkKeyRateLimit('test-key', 5, 60_000);
    assert.equal(keyResult.allowed, true);
    assert.equal(keyResult.remaining, 4);
    assert.equal(keyResult.limit, 5);
  });

  it('blocks per-key requests after limit', () => {
    const limit = 2;
    for (let i = 0; i < limit; i++) {
      checkKeyRateLimit('test-key', limit, 60_000);
    }
    const result = checkKeyRateLimit('test-key', limit, 60_000);
    assert.equal(result.allowed, false);
  });

  it('getRateLimitStatus returns status without consuming', () => {
    checkRateLimit('test-tenant', 10, 60_000);
    const status = getRateLimitStatus('test-tenant', 10, 60_000);
    assert.equal(status.remaining, 9);
    assert.equal(status.limit, 10);
    assert.ok(status.resetTime > Date.now());
  });

  it('reset clears rate limit counters', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('test-tenant', 5, 60_000);
    }
    resetTenantRateLimit('test-tenant');
    const result = checkRateLimit('test-tenant', 5, 60_000);
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 4);
  });

  it('getQuotaResetTime returns valid ISO dates', () => {
    const dailyReset = getQuotaResetTime('daily');
    const monthlyReset = getQuotaResetTime('monthly');
    assert.ok(dailyReset.match(/^\d{4}-\d{2}-\d{2}T/));
    assert.ok(monthlyReset.match(/^\d{4}-\d{2}-\d{2}T/));
  });
});

describe('Per-Key Usage Tracking', () => {
  it('tracks per-key daily usage', async () => {
    const db = new MemoryStorage();
    db.registerTenant(
      { id: 'test-tenant', name: 'Test', emailVerified: true, tier: 'free', isActive: true, journalismMode: false },
      'test-hash',
      'key-1',
      'test-key',
    );

    const date = new Date().toISOString().slice(0, 10);
    await db.incrementKeyUsage('key-1', date, '2026-05');
    const usage = await db.getKeyDailyUsage('key-1', date);
    assert.equal(usage, 1);
  });

  it('tracks per-key monthly usage', async () => {
    const db = new MemoryStorage();
    db.registerTenant(
      { id: 'test-tenant', name: 'Test', emailVerified: true, tier: 'free', isActive: true, journalismMode: false },
      'test-hash',
      'key-1',
      'test-key',
    );

    await db.incrementKeyUsage('key-1', '2026-05-19', '2026-05');
    await db.incrementKeyUsage('key-1', '2026-05-19', '2026-05');
    const usage = await db.getKeyMonthlyUsage('key-1', '2026-05');
    assert.equal(usage, 2);
  });

  it('returns key usage breakdown', async () => {
    const db = new MemoryStorage();
    db.registerTenant(
      { id: 'test-tenant', name: 'Test', emailVerified: true, tier: 'free', isActive: true, journalismMode: false },
      'hash-1',
      'key-1',
      'primary-key',
    );
    db.registerTenant(
      { id: 'test-tenant', name: 'Test', emailVerified: true, tier: 'free', isActive: true, journalismMode: false },
      'hash-2',
      'key-2',
      'secondary-key',
    );

    await db.incrementKeyUsage('key-1', '2026-05-19', '2026-05');
    await db.incrementKeyUsage('key-1', '2026-05-19', '2026-05');
    await db.incrementKeyUsage('key-2', '2026-05-19', '2026-05');

    const breakdown = await db.getKeyUsageBreakdown('test-tenant', '2026-05');
    assert.equal(breakdown.length, 2);
    assert.equal(breakdown[0].keyId, 'key-1');
    assert.equal(breakdown[0].monthlyCalls, 2);
    assert.equal(breakdown[1].keyId, 'key-2');
    assert.equal(breakdown[1].monthlyCalls, 1);
  });
});

describe('Response Headers', () => {
  it('addRateLimitHeaders adds rate limit headers', () => {
    const baseResponse = new Response('{"success":true}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const response = addRateLimitHeaders(baseResponse, {
      remaining: 42,
      resetTime: 1716100000,
      limit: 60,
    });
    assert.equal(response.headers.get('X-RateLimit-Remaining'), '42');
    assert.equal(response.headers.get('X-RateLimit-Reset'), '1716100');
    assert.equal(response.headers.get('X-RateLimit-Limit'), '60');
  });

  it('addQuotaHeaders adds quota headers', () => {
    const baseResponse = new Response('{"success":true}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const response = addQuotaHeaders(baseResponse, {
      monthlyLimit: 1000,
      monthlyRemaining: 950,
      monthlyReset: '2026-06-01T00:00:00.000Z',
      dailyLimit: 35,
      dailyRemaining: 30,
      dailyReset: '2026-05-20T00:00:00.000Z',
    });
    assert.equal(response.headers.get('X-Quota-Limit'), '1000');
    assert.equal(response.headers.get('X-Quota-Remaining'), '950');
    assert.equal(response.headers.get('X-Quota-Reset'), '2026-06-01T00:00:00.000Z');
    assert.equal(response.headers.get('X-Daily-Limit'), '35');
    assert.equal(response.headers.get('X-Daily-Remaining'), '30');
    assert.equal(response.headers.get('X-Daily-Reset'), '2026-05-20T00:00:00.000Z');
  });

  it('addUsageHeaders adds both rate limit and quota headers', () => {
    const baseResponse = new Response('{"success":true}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const response = addUsageHeaders(baseResponse, {
      remaining: 50,
      resetTime: 1716100000,
      limit: 60,
    }, {
      monthlyLimit: 1000,
      monthlyRemaining: 950,
      monthlyReset: '2026-06-01T00:00:00.000Z',
      dailyLimit: 35,
      dailyRemaining: 30,
      dailyReset: '2026-05-20T00:00:00.000Z',
    });
    assert.equal(response.headers.get('X-RateLimit-Remaining'), '50');
    assert.equal(response.headers.get('X-RateLimit-Limit'), '60');
    assert.equal(response.headers.get('X-Quota-Limit'), '1000');
    assert.equal(response.headers.get('X-Daily-Limit'), '35');
  });

  it('rate limit headers clamp remaining to 0 minimum', () => {
    const baseResponse = new Response('{"success":true}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const response = addRateLimitHeaders(baseResponse, {
      remaining: -5,
      resetTime: 1716100000,
    });
    assert.equal(response.headers.get('X-RateLimit-Remaining'), '0');
  });
});

describe('Usage Endpoint', () => {
  it('returns usage data with per-key breakdown', async () => {
    const { usageHandler } = await import('../routes/usage.js');
    const db = new MemoryStorage();
    const cache = new MemoryCache();
    db.registerTenant(
      { id: 'test-tenant', name: 'Test User', emailVerified: true, tier: 'pro', isActive: true, journalismMode: false },
      'test-hash',
      'key-1',
      'test-key',
    );

    // Simulate some usage
    const date = new Date().toISOString().slice(0, 10);
    const yearMonth = new Date().toISOString().slice(0, 7);
    await db.incrementUsage('test-tenant', date, yearMonth);
    await db.incrementKeyUsage('key-1', date, yearMonth);

    const ctx = {
      tenant: { id: 'test-tenant', name: 'Test User', emailVerified: true, tier: 'pro' as const, isActive: true, journalismMode: false },
      apiKeyId: 'key-1',
      requestId: 'test',
      startTime: Date.now(),
      env: {},
      db,
      cache,
    };

    const resp = await usageHandler(new Request('http://localhost/v1/usage'), ctx as any, {});
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.ok(body.success);
    assert.ok(body.data.usage.daily);
    assert.ok(body.data.usage.monthly);
    assert.ok(body.data.usage.rate);
    assert.ok(Array.isArray(body.data.keys));
  });
});
