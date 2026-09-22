import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter, TIER_LIMITS, WINDOW_SECONDS } from '../rate-limiter.js';
import type { Tier } from '../rate-limiter.js';

/** Minimal ServerResponse stand-in: records status, headers and body. */
function fakeResponse() {
  const headers: Record<string, string> = {};
  return {
    statusCode: 200,
    body: '',
    headers,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    end(chunk?: string) {
      if (chunk !== undefined) this.body = chunk;
    },
  };
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

  describe('check (no Redis configured — the in-process window enforces)', () => {
    it('returns a decision instead of null when Redis is not connected', async () => {
      // Regression for A2-REDIS (#764, #770). check() used to answer null —
      // "allow the request, do not enforce" — whenever Redis was unreachable,
      // so a missing Redis meant an unlimited API. The in-process sliding
      // window is the fallback now, and check() never returns null.
      const result = await limiter.check('127.0.0.1', 'FREE');
      assert.ok(result !== null);
      assert.equal(result.allowed, true);
      assert.equal(result.limit, TIER_LIMITS.FREE);
      assert.equal(result.remaining, TIER_LIMITS.FREE - 1);
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

    it('admits a request when Redis is not connected, with rate-limit headers', async () => {
      const mw = limiter.middleware();
      let nextCalled = false;
      const req = { url: '/v1/modules', headers: { 'x-forwarded-for': '203.0.113.11' } };
      const res = fakeResponse();
      await mw(req, res, () => { nextCalled = true; });
      assert.ok(nextCalled);
      assert.equal(res.headers['x-ratelimit-limit'], String(TIER_LIMITS.FREE));
      assert.equal(res.headers['x-ratelimit-remaining'], String(TIER_LIMITS.FREE - 1));
    });

    it('answers 429 past the tier limit with Redis down (regression: Redis down is not unlimited)', async () => {
      const mw = limiter.middleware();
      const makeReq = () => ({
        url: '/v1/modules',
        headers: { 'x-forwarded-for': '203.0.113.12' },
      });
      let nextCalls = 0;

      for (let i = 0; i < TIER_LIMITS.FREE; i++) {
        const res = fakeResponse();
        await mw(makeReq(), res, () => { nextCalls += 1; });
        assert.equal(res.statusCode, 200, `request ${i + 1} of ${TIER_LIMITS.FREE} must be admitted`);
      }

      const blocked = fakeResponse();
      await mw(makeReq(), blocked, () => { nextCalls += 1; });

      assert.equal(blocked.statusCode, 429);
      assert.equal(blocked.headers['x-ratelimit-remaining'], '0');
      const retryAfter = Number(blocked.headers['retry-after']);
      assert.ok(retryAfter >= 0 && retryAfter <= WINDOW_SECONDS, `retry-after was ${retryAfter}`);
      assert.match(blocked.body, /rate_limit_exceeded/);
      assert.equal(nextCalls, TIER_LIMITS.FREE, 'the blocked request must not reach the handler');
    });
  });
});
