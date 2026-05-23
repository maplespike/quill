import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('ircc:study-permits', () => {
  it('should define the ingest function', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.ingestStudyPermit, 'function');
  });
  it('should define search functions', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.searchStudyPermitsByProvince, 'function');
    assert.strictEqual(typeof mod.searchStudyPermitsByInstitution, 'function');
  });
});
