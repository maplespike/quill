import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// Live upstreams must never gate a deploy. deploy-prod runs the suite with
// SKIP_NETWORK_TESTS=1; PR CI and local runs exercise these for real.
const SKIP_LIVE = process.env.SKIP_NETWORK_TESTS === '1';
const SKIP_LIVE_REASON = 'SKIP_NETWORK_TESTS=1';

describe('corporate-filings Module', { skip: SKIP_LIVE && SKIP_LIVE_REASON }, () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.equal(typeof mod.ingestAllFilings, 'function');
    assert.equal(typeof mod.fetchAllFilings, 'function');
  });
  it('fetchAllFilings returns records', async () => {
    const result = await (await import('../index.js')).fetchAllFilings();
    assert.ok(Array.isArray(result.records));
    assert.ok(typeof result.totalFetched === 'number');
    if (result.records.length > 0) {
      assert.ok(result.records[0].corporationNumber);
      assert.ok(result.records[0].corporationName);
    }
  });
});
