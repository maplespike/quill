import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter, TIER_LIMITS } from '../rate-limiter.js';
import type { Tier } from '../rate-limiter.js';

/** Minimal stand-in for a Node ServerResponse: records headers and body. */
function makeRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: '',
    setHeader(name: string, value: string): void {
      res.headers[name] = value;
    },
    end(chunk?: string): void {
      if (chunk !== undefined) res.body = chunk;
    },
  };
  return res;
}

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  before(() => {
    limiter = new RateLimiter();
  });

  after(async () => {
    await limiter.disconnect();
  });

  describe('extractIP', () => {
    it('returns x-forwarded-for when present', () => {
      const req = { headers: { 'x-forwarded-for': '203.0.113.5, 198.51.100.9' } };
      assert.equal(limiter.extractIP(req), '203.0.113.5');
    });

    it('falls back to req.ip', () => {
      const req = { headers: {}, ip: '192.0.2.10' };
      assert.equal(limiter.extractIP(req), '192.0.2.10');
    });

    it('returns unknown when no IP info available', () => {
      const req = { headers: {} };
      assert.equal(limiter.extractIP(req), 'unknown');
    });
  });

  describe('extractTier', () => {
    it('returns FREE by default', () => {
      const req = { headers: {} };
      assert.equal(limiter.extractTier(req), 'FREE');
    });

    it('detects BASIC from x-api-key prefix', () => {
      const req = { headers: { 'x-api-key': 'msk_basic_abc123' } };
      assert.equal(limiter.extractTier(req), 'BASIC');
    });

    it('detects PREMIUM from x-api-key prefix', () => {
      const req = { headers: { 'x-api-key': 'msk_premium_xyz' } };
      assert.equal(limiter.extractTier(req), 'PREMIUM');
    });

    it('detects PREMIUM from enterprise prefix', () => {
      const req = { headers: { 'x-api-key': 'msk_enterprise_xyz' } };
      assert.equal(limiter.extractTier(req), 'PREMIUM');
    });

    it('reads user.plan as fallback', () => {
      const req = { headers: {}, user: { plan: 'basic' } };
      assert.equal(limiter.extractTier(req), 'BASIC');
    });

    it('reads user.plan for premium', () => {
      const req = { headers: {}, user: { plan: 'premium' } };
      assert.equal(limiter.extractTier(req), 'PREMIUM');
    });
  });

  describe('TIER_LIMITS', () => {
    it('has correct values for all tiers', () => {
      assert.equal(TIER_LIMITS.FREE, 100);
      assert.equal(TIER_LIMITS.BASIC, 1000);
      assert.equal(TIER_LIMITS.PREMIUM, 10000);
    });
  });

  describe('check (without Redis — in-process window)', () => {
    it('returns a decision, not null, when Redis is not connected', async () => {
      const result = await limiter.check('198.51.100.10', 'FREE');

      assert.notEqual(result, null);
      assert.equal(result.allowed, true);
      assert.equal(result.limit, TIER_LIMITS.FREE);
      assert.equal(result.remaining, TIER_LIMITS.FREE - 1);
    });

    it('blocks the request once the window is full', async () => {
      const ip = '198.51.100.11';

      for (let i = 0; i < TIER_LIMITS.FREE; i++) {
        assert.equal((await limiter.check(ip, 'FREE')).allowed, true);
      }

      const blocked = await limiter.check(ip, 'FREE');

      assert.equal(blocked.allowed, false);
      assert.equal(blocked.remaining, 0);
      assert.ok(blocked.retryAfter > 0);
    });
  });

  describe('middleware', () => {
    it('passes through for health endpoint', async () => {
      const mw = limiter.middleware();
      let nextCalled = false;
      const req = { url: '/v1/health' };
      const res = {};
      await mw(req, res, () => { nextCalled = true; });
      assert.ok(nextCalled);
    });

    it('calls next() while the window has room (no Redis)', async () => {
      const mw = limiter.middleware();
      let nextCalled = false;
      const req = { url: '/v1/modules', headers: {}, socket: { remoteAddress: '198.51.100.12' } };
      const res = makeRes();

      await mw(req, res, () => { nextCalled = true; });

      assert.ok(nextCalled);
      assert.equal(res.headers['X-RateLimit-Limit'], String(TIER_LIMITS.FREE));
    });

    it('answers 429 when the window is full, even without Redis', async () => {
      const mw = limiter.middleware();
      const ip = '198.51.100.13';
      const request = () => ({
        url: '/v1/modules',
        headers: {},
        socket: { remoteAddress: ip },
      });

      for (let i = 0; i < TIER_LIMITS.FREE; i++) {
        let nextCalled = false;
        await mw(request(), makeRes(), () => { nextCalled = true; });
        assert.ok(nextCalled);
      }

      let nextCalled = false;
      const res = makeRes();
      await mw(request(), res, () => { nextCalled = true; });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 429);
      assert.ok(res.headers['Retry-After'] !== undefined);
      assert.match(String(res.body), /rate_limit_exceeded/);
      assert.equal(res.headers['x-content-type-options'], 'nosniff');
      assert.equal(res.headers['x-frame-options'], 'DENY');
      assert.equal(res.headers['access-control-allow-origin'], 'null');
      assert.equal(res.headers['access-control-allow-methods'], 'GET, POST, PATCH, DELETE, OPTIONS');
    });
  });
});
