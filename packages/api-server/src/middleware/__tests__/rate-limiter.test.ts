import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter, TIER_LIMITS } from '../rate-limiter.js';
import type { Tier } from '../rate-limiter.js';

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

  describe('check (without Redis — pass-through)', () => {
    it('returns null when Redis is not connected', async () => {
      const result = await limiter.check('127.0.0.1', 'FREE');
      assert.equal(result, null);
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

    it('passes through when Redis is not connected (graceful degradation)', async () => {
      const mw = limiter.middleware();
      let nextCalled = false;
      const req = { url: '/v1/modules', headers: {} };
      const res = {};
      await mw(req, res, () => { nextCalled = true; });
      assert.ok(nextCalled);
    });
  });
});
