/**
 * Tests for Redis-backed sliding window rate limiter.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIER_LIMITS,
  makeRateLimitKey,
  getClientIP,
  checkRateLimit,
  applyRateLimit,
  addRateLimitHeaders,
  buildRateLimitResponse,
  resolveTier,
} from '../middleware/rate-limiter.js';

/** Mock Redis client that stores data in a Map */
class MockRedis {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async setEx(key: string, _ttl: number, value: string): Promise<unknown> {
    this.store.set(key, value);
    return 'OK';
  }
}

describe('Rate Limiter', () => {
  describe('TIER_LIMITS', () => {
    it('has correct per-minute limits for each tier', () => {
      assert.equal(TIER_LIMITS.free, 100);
      assert.equal(TIER_LIMITS.basic, 1000);
      assert.equal(TIER_LIMITS.premium, 10000);
    });

    it('all tiers have positive limits', () => {
      for (const [tier, limit] of Object.entries(TIER_LIMITS)) {
        assert.ok(limit > 0, `Tier ${tier} has limit ${limit}`);
        assert.ok(limit <= 20000, `Tier ${tier} has limit ${limit} — too high`);
      }
    });
  });

  describe('makeRateLimitKey', () => {
    it('generates a namespaced key with tier and IP', () => {
      const key = makeRateLimitKey('1.2.3.4', 'free');
      assert.equal(key, 'ratelimit:free:1.2.3.4');
    });

    it('defaults to free tier', () => {
      const key = makeRateLimitKey('1.2.3.4');
      assert.equal(key, 'ratelimit:free:1.2.3.4');
    });
  });

  describe('getClientIP', () => {
    it('returns 127.0.0.1 when no proxy headers are set', () => {
      const req = new Request('http://localhost/v1/test');
      const ip = getClientIP(req);
      assert.equal(ip, '127.0.0.1');
    });
  });

  describe('resolveTier', () => {
    it('defaults to free when no tier header', () => {
      const req = new Request('http://localhost/v1/test');
      assert.equal(resolveTier(req), 'free');
    });

    it('returns tier from X-API-Tier header', () => {
      const req = new Request('http://localhost/v1/test', {
        headers: { 'X-API-Tier': 'premium' },
      });
      assert.equal(resolveTier(req), 'premium');
    });

    it('defaults to free for unknown tier header', () => {
      const req = new Request('http://localhost/v1/test', {
        headers: { 'X-API-Tier': 'unknown' },
      });
      assert.equal(resolveTier(req), 'free');
    });
  });

  describe('checkRateLimit — Redis-backed', () => {
    let redis: MockRedis;

    beforeEach(() => {
      redis = new MockRedis();
    });

    it('allows requests under the limit', async () => {
      const result = await checkRateLimit(redis, 'ratelimit:free:1.2.3.4', 100);
      assert.equal(result.allowed, true);
      assert.equal(result.limit, 100);
      assert.ok(result.remaining >= 0);
      assert.ok(result.reset > 0);
    });

    it('blocks when limit is exceeded', async () => {
      const key = 'ratelimit:free:5.6.7.8';
      const limit = 5;

      // Exhaust the limit
      for (let i = 0; i < limit; i++) {
        await checkRateLimit(redis, key, limit);
      }

      // Should now be blocked
      const result = await checkRateLimit(redis, key, limit);
      assert.equal(result.allowed, false);
      assert.equal(result.remaining, 0);
      assert.ok(result.retryAfter > 0);
    });

    it('enforces free tier limit', async () => {
      const key = 'ratelimit:free:9.9.9.9';
      const limit = TIER_LIMITS.free;

      // Make requests up to the limit
      for (let i = 0; i < limit; i++) {
        const r = await checkRateLimit(redis, key, limit);
        assert.equal(r.allowed, true, `Request ${i + 1} should be allowed`);
      }

      // Next request should be blocked
      const blocked = await checkRateLimit(redis, key, limit);
      assert.equal(blocked.allowed, false);
    });

    it('enforces premium tier limit correctly', async () => {
      const key = 'ratelimit:premium:10.0.0.1';
      const limit = TIER_LIMITS.premium;

      // First request should be allowed with remaining = limit - 1
      const first = await checkRateLimit(redis, key, limit);
      assert.equal(first.allowed, true);
      assert.equal(first.limit, limit);
    });
  });

  describe('checkRateLimit — in-memory fallback', () => {
    it('falls back to in-memory when Redis is null', async () => {
      const result = await checkRateLimit(null, 'ratelimit:free:10.0.0.2', 100);
      assert.equal(result.allowed, true);
      assert.equal(result.limit, 100);
    });

    it('in-memory fallback blocks at limit', async () => {
      const key = 'ratelimit:free:10.0.0.3';
      const limit = 3;

      for (let i = 0; i < limit; i++) {
        await checkRateLimit(null, key, limit);
      }

      const result = await checkRateLimit(null, key, limit);
      assert.equal(result.allowed, false);
      assert.equal(result.remaining, 0);
      assert.ok(result.retryAfter > 0);
    });
  });

  describe('applyRateLimit', () => {
    it('exempts /v1/health', async () => {
      const req = new Request('http://localhost/v1/health');
      const result = await applyRateLimit(null, req, 'free');
      assert.equal(result, null);
    });

    it('applies rate limit to other paths', async () => {
      const req = new Request('http://localhost/v1/modules');
      const result = await applyRateLimit(null, req, 'free');
      assert.ok(result !== null);
      assert.equal(result.allowed, true);
    });

    it('uses tier from parameter', async () => {
      const req = new Request('http://localhost/v1/modules');
      const free = await applyRateLimit(null, req, 'free');
      const premium = await applyRateLimit(null, req, 'premium');
      assert.ok(free !== null && premium !== null);
      assert.ok(premium.remaining > free.remaining, 'Premium should have more remaining');
    });
  });

  describe('addRateLimitHeaders', () => {
    it('adds X-RateLimit-* headers to an existing response', () => {
      const result = { allowed: true, limit: 100, remaining: 99, reset: 12345, retryAfter: 0 };
      const response = new Response('OK', { status: 200 });
      const withHeaders = addRateLimitHeaders(response, result);

      assert.equal(withHeaders.headers.get('X-RateLimit-Limit'), '100');
      assert.equal(withHeaders.headers.get('X-RateLimit-Remaining'), '99');
      assert.equal(withHeaders.headers.get('X-RateLimit-Reset'), '12345');
    });
  });

  describe('buildRateLimitResponse', () => {
    it('returns 429 with correct JSON body and headers', () => {
      const result = { allowed: false, limit: 100, remaining: 0, reset: 99999, retryAfter: 42 };
      const response = buildRateLimitResponse(result);

      assert.equal(response.status, 429);
      assert.equal(response.headers.get('Retry-After'), '42');
      assert.equal(response.headers.get('X-RateLimit-Limit'), '100');
      assert.equal(response.headers.get('X-RateLimit-Remaining'), '0');
      assert.equal(response.headers.get('X-RateLimit-Reset'), '99999');
      assert.equal(response.headers.get('Content-Type'), 'application/json');
    });

    it('response body has error and retry_after fields', async () => {
      const result = { allowed: false, limit: 100, remaining: 0, reset: 99999, retryAfter: 42 };
      const response = buildRateLimitResponse(result);
      const body = await response.json() as Record<string, unknown>;

      assert.equal(body.error, 'rate_limit_exceeded');
      assert.equal(body.retry_after, 42);
    });
  });
});
