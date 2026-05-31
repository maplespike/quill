import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('impact-assessment Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestIaacAssessments, 'function', 'Should export ingestIaacAssessments');
    assert.equal(typeof mod.searchIaacRecords, 'function', 'Should export searchIaacRecords');
  });
});
