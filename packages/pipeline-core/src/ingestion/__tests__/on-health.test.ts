import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('on-health Module', () => {
  it('has required exports', async () => {
    const mod = await import('../on-health/index.js');
    assert.equal(typeof mod.initializeOntarioHealthTable, 'function');
    assert.equal(typeof mod.searchONHealthRecords, 'function');
    assert.equal(typeof mod.ingestOntarioHealthClaims, 'function');
    assert.equal(typeof mod.ingestAllONHealth, 'function');
  });
});
