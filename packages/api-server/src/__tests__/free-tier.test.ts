/**
 * Free-Tier Boundary Tests (decision #803)
 *
 * Verifies the single source of truth for what a Free tenant may call:
 * discovery / metadata only. Data queries + AI + tool execution are Pro+.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isFreeTierRoute, FREE_TIER_ALLOWED_PREFIXES } from '../feature-gates.js';

describe('isFreeTierRoute — Free tier whitelist', () => {
  const allowed: string[] = [
    '/v1/health',
    '/v1/version',
    '/v1/onboarding',
    '/v1/compliance',
    '/v1/citation/foo',
    '/v1/gov/releases',
    '/v1/billing/plans',
    '/v1/billing/stripe/checkout',
    '/v1/billing/stripe/portal',
    '/v1/billing/stripe/status',
    '/v1/billing/stripe/order/abc',
    '/v1/billing/seed-plans',
    '/v1/auth/oauth/providers',
    '/v1/register',
    '/v1/verify/tok',
    '/v1/usage',
    '/v1/contact',
    '/v1/security/audit-summary',
    '/v1/engine/status',
    '/v1/data/quality',
  ];

  const blocked: string[] = [
    '/v1/gov/search',
    '/v1/entity/resolve',
    '/v1/energy',
    '/v1/real-estate',
    '/v1/financial-regulation/crossref',
    '/v1/municipal/coverage',
    '/v1/audit/query',
    '/v1/watcher/events',
    '/v1/extraction/results',
    '/v1/annotations',
    '/v1/ai/ask',
    '/v1/ai/analyze',
    '/v1/ai/settings',
    '/v1/keys',
    '/v1/export/foo',
  ];

  for (const path of allowed) {
    it(`allows Free on discovery/metadata route: ${path}`, () => {
      assert.equal(isFreeTierRoute(path), true, `expected ${path} allowed for Free`);
    });
  }

  for (const path of blocked) {
    it(`blocks Free on data/AI/tool route: ${path}`, () => {
      assert.equal(isFreeTierRoute(path), false, `expected ${path} blocked for Free`);
    });
  }

  it('whitelist is non-empty and contains the catalog/discovery anchors', () => {
    assert.ok(FREE_TIER_ALLOWED_PREFIXES.length > 0);
    assert.ok(FREE_TIER_ALLOWED_PREFIXES.includes('/v1/health'));
    assert.ok(FREE_TIER_ALLOWED_PREFIXES.includes('/v1/citation/'));
  });
});
