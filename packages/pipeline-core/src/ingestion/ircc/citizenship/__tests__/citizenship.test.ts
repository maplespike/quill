import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('ircc:citizenship', () => {
  it('should define the ingest function', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.ingestCitizenshipGrant, 'function');
  });
  it('should define search functions', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.searchCitizenshipByProvince, 'function');
    assert.strictEqual(typeof mod.searchCitizenshipByYear, 'function');
  });
});
