// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Tests for the Redis-backed sliding-window rate limiter (RateLimiter class)
 * and the response-level rate-limit header helper (addRateLimitHeaders).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TIER_LIMITS, RateLimiter } from '../middleware/rate-limiter.js';
import { addRateLimitHeaders } from '../response.js';

/** Build a minimal Request-like object accepted by RateLimiter.extractIP/extractTier. */
function fakeReq(opts: {
  forwardedFor?: string;
  apiKey?: string;
  plan?: string;
  ip?: string;
} = {}) {
  const headers: Record<string, string> = {};
  if (opts.forwardedFor !== undefined) headers['x-forwarded-for'] = opts.forwardedFor;
  if (opts.apiKey !== undefined) headers['x-api-key'] = opts.apiKey;
  const req: { headers: Record<string, string>; ip?: string; user?: { plan?: string } } = {
    headers,
    ip: opts.ip,
  };
  if (opts.plan !== undefined) req.user = { plan: opts.plan };
  return req;
}

describe('Rate Limiter', () => {
  describe('TIER_LIMITS', () => {
    it('has correct per-minute limits for each tier', () => {
      assert.equal(TIER_LIMITS.FREE, 100);
      assert.equal(TIER_LIMITS.BASIC, 1000);
      assert.equal(TIER_LIMITS.PREMIUM, 10000);
    });

    it('all tiers have positive, bounded limits', () => {
      for (const [tier, limit] of Object.entries(TIER_LIMITS)) {
        assert.ok(limit > 0, `Tier ${tier} has limit ${limit}`);
        assert.ok(limit <= 20000, `Tier ${tier} has limit ${limit} — too high`);
      }
    });
  });

  describe('RateLimiter.extractIP', () => {
    it('returns the first x-forwarded-for address', () => {
      const rl = new RateLimiter();
      const ip = rl.extractIP(fakeReq({ forwardedFor: '1.2.3.4, 198.51.100.9' }));
      assert.equal(ip, '1.2.3.4');
    });

    it('falls back to req.ip when no forwarded header', () => {
      const rl = new RateLimiter();
      const ip = rl.extractIP(fakeReq({ ip: '9.9.9.9' }));
      assert.equal(ip, '9.9.9.9');
    });

    it('returns "unknown" when nothing is present', () => {
      const rl = new RateLimiter();
      assert.equal(rl.extractIP(fakeReq()), 'unknown');
    });
  });

  describe('RateLimiter.extractTier', () => {
    it('defaults to FREE with no key or plan', () => {
      const rl = new RateLimiter();
      assert.equal(rl.extractTier(fakeReq()), 'FREE');
    });

    it('resolves BASIC from msk_basic_ key prefix', () => {
      const rl = new RateLimiter();
      assert.equal(rl.extractTier(fakeReq({ apiKey: 'msk_basic_abc' })), 'BASIC');
    });

    it('resolves PREMIUM from msk_premium_ / msk_enterprise_ key prefix', () => {
      const rl = new RateLimiter();
      assert.equal(rl.extractTier(fakeReq({ apiKey: 'msk_premium_xyz' })), 'PREMIUM');
      assert.equal(rl.extractTier(fakeReq({ apiKey: 'msk_enterprise_q' })), 'PREMIUM');
    });

    it('falls back to user.plan (case-insensitive)', () => {
      const rl = new RateLimiter();
      assert.equal(rl.extractTier(fakeReq({ plan: 'basic' })), 'BASIC');
      assert.equal(rl.extractTier(fakeReq({ plan: 'Premium' })), 'PREMIUM');
    });
  });

  describe('addRateLimitHeaders', () => {
    it('adds X-RateLimit-Remaining and X-RateLimit-Reset (seconds) headers', () => {
      const response = new Response('OK', { status: 200 });
      const modified = addRateLimitHeaders(response, { remaining: 42, resetTime: 1700000000000 });

      assert.equal(modified.headers.get('X-RateLimit-Remaining'), '42');
      assert.equal(modified.headers.get('X-RateLimit-Reset'), String(Math.floor(1700000000000 / 1000)));
    });

    it('clamps negative remaining to zero', () => {
      const response = new Response('OK', { status: 200 });
      const modified = addRateLimitHeaders(response, { remaining: -5, resetTime: 0 });
      assert.equal(modified.headers.get('X-RateLimit-Remaining'), '0');
    });

    it('preserves the original status and body', async () => {
      const response = new Response('test-data', { status: 201 });
      const modified = addRateLimitHeaders(response, { remaining: 99, resetTime: 9999999999000 });
      assert.equal(modified.status, 201);
      assert.equal(await modified.text(), 'test-data');
    });
  });
});
