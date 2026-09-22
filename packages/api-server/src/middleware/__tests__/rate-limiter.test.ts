/**
 * Middleware-level tests for the rate limiter.
 *
 * Gate A2-REDIS (#764, #770) retired the pass-through contract: `check()` used
 * to answer `null` — "allow the request, do not enforce" — whenever Redis was
 * unreachable, so a missing Redis meant an unlimited API. The limiter now
 * always returns a decision, and with no Redis configured it enforces the tier
 * limit in-process.
 *
 * This file used to assert the retired contract (`result === null`), which is
 * why CI failed on main after #899 merged: the assertion, not the limiter, was
 * stale. The tests below pin the current contract. Deep coverage of the
 * in-process window and of the Redis result mapping lives in
 * `src/__tests__/rate-limiter-backend.test.ts`.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter, TIER_LIMITS, WINDOW_SECONDS } from '../rate-limiter.js';

/** A minimal Response-like object that records the headers and body it is given. */
function fakeRes() {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    body: '',
    setHeader(name: string, value: string): void {
      headers[name] = value;
    },
    end(body: string): void {
      res.body = body;
    },
  };
  return { res, headers };
}

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  before(async () => {
    limiter = new RateLimiter();
    // Empty URL = "no Redis here": the limiter enforces in-process, and no
    // connection is attempted.
    await limiter.init('');
  });

  after(async () => {
    await limiter.disconnect();
  });

  describe('extractIP', () => {
    it('returns x-forwarded-for when present', () => {
      const req = { headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' } };
      assert.equal(limiter.extractIP(req), '203.0.113.5');
    });

    it('falls back to req.ip', () => {
      const req = { headers: {}, ip: '192.168.1.1' };
      assert.equal(limiter.extractIP(req), '192.168.1.1');
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

  describe('check (no Redis configured — in-process window, never pass-through)', () => {
    it('returns a decision instead of null when Redis is not connected', async () => {
      const rl = new RateLimiter();
      await rl.init('');

      assert.equal(rl.isConnected(), false);
      assert.equal(rl.backendMode(), 'memory');

      const result = await rl.check('127.0.0.1', 'FREE');

      // The retired contract was `null` = "allow, do not enforce".
      assert.ok(result !== null, 'check() must never answer "no opinion"');
      assert.equal(result.allowed, true);
      assert.equal(result.limit, TIER_LIMITS.FREE);
      assert.equal(result.remaining, TIER_LIMITS.FREE - 1);
    });

    it('blocks the (limit + 1)-th request from the same caller', async () => {
      const rl = new RateLimiter();
      await rl.init('');
      const ip = '198.51.100.7';

      for (let i = 0; i < TIER_LIMITS.FREE; i++) {
        const result = await rl.check(ip, 'FREE');
        assert.equal(result.allowed, true, `request ${i + 1} of ${TIER_LIMITS.FREE} must be allowed`);
      }

      const blocked = await rl.check(ip, 'FREE');

      assert.equal(blocked.allowed, false);
      assert.equal(blocked.remaining, 0);
      assert.ok(
        blocked.retryAfter > 0 && blocked.retryAfter <= WINDOW_SECONDS,
        `retryAfter ${blocked.retryAfter} must fall inside the window`,
      );
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

    it('serves requests under the limit while Redis is not connected', async () => {
      const mw = limiter.middleware();
      let nextCalled = false;
      const req = { url: '/v1/modules', headers: {} };
      const res = {};
      await mw(req, res, () => { nextCalled = true; });
      assert.ok(nextCalled);
    });

    it('attaches the rate-limit headers on an allowed request', async () => {
      const rl = new RateLimiter();
      await rl.init('');
      const mw = rl.middleware();
      const { res, headers } = fakeRes();
      const req = { url: '/v1/modules', headers: { 'x-forwarded-for': '203.0.113.60' } };

      await mw(req, res, () => {});

      assert.equal(headers['X-RateLimit-Limit'], String(TIER_LIMITS.FREE));
      assert.equal(headers['X-RateLimit-Remaining'], String(TIER_LIMITS.FREE - 1));
      assert.ok(Number(headers['X-RateLimit-Reset']) > 0);
    });

    it('answers 429 — and never calls next() — once the window is full', async () => {
      const rl = new RateLimiter();
      await rl.init('');
      const mw = rl.middleware();
      const { res, headers } = fakeRes();
      const req = { url: '/v1/modules', headers: { 'x-forwarded-for': '203.0.113.61' } };

      let nextCalls = 0;
      for (let i = 0; i < TIER_LIMITS.FREE; i++) {
        await mw(req, res, () => { nextCalls += 1; });
      }
      assert.equal(nextCalls, TIER_LIMITS.FREE, 'every request under the limit must reach the handler');

      await mw(req, res, () => { nextCalls += 1; });

      assert.equal(nextCalls, TIER_LIMITS.FREE, 'the request over the limit must not reach the handler');
      assert.equal(res.statusCode, 429);
      assert.equal(headers['X-RateLimit-Remaining'], '0');
      assert.ok(Number(headers['Retry-After']) > 0);
      assert.deepEqual(JSON.parse(res.body), {
        error: 'rate_limit_exceeded',
        retry_after: Number(headers['Retry-After']),
      });
    });

    it('keeps the health endpoint exempt even with a full window', async () => {
      const rl = new RateLimiter();
      await rl.init('');
      const mw = rl.middleware();
      const blockedReq = { url: '/v1/modules', headers: { 'x-forwarded-for': '203.0.113.62' } };

      for (let i = 0; i < TIER_LIMITS.FREE; i++) {
        await mw(blockedReq, fakeRes().res, () => {});
      }

      let nextCalled = false;
      await mw({ url: '/v1/health', headers: { 'x-forwarded-for': '203.0.113.62' } }, fakeRes().res, () => {
        nextCalled = true;
      });

      assert.ok(nextCalled, 'a health probe must never be rate limited');
    });
  });
});
