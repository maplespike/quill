import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
describe('corporate-filings Module', () => {
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
