// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('education-research Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestTriCouncil, 'function', 'Should export ingestTriCouncil');
    assert.equal(typeof mod.ingestResearchChairs, 'function', 'Should export ingestResearchChairs');
    assert.equal(typeof mod.ingestCFIData, 'function', 'Should export ingestCFIData');
    assert.equal(typeof mod.ingestStudentLoans, 'function', 'Should export ingestStudentLoans');
    assert.equal(typeof mod.ingestAllEducationResearch, 'function', 'Should export ingestAllEducationResearch');
  });
});
