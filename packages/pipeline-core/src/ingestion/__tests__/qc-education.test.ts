import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('qc-education Module', () => {
  it('has required exports', async () => {
    const mod = await import('../qc-education/index.js');
    assert.equal(typeof mod.ingestQcEducationData, 'function');
    assert.equal(typeof mod.searchQcEducationRecords, 'function');
  });
});
