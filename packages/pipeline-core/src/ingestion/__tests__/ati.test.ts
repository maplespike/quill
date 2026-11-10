// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ati Module', () => {
  it('has required exports', async () => {
    const mod = await import('../ati/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAti, 'function', 'Should export ingestAti');
    assert.equal(typeof mod.ingestAllAti, 'function', 'Should export ingestAllAti');
    assert.equal(typeof mod.searchAtiRecords, 'function', 'Should export searchAtiRecords');
    assert.equal(typeof mod.getAtiByDepartment, 'function', 'Should export getAtiByDepartment');
    assert.equal(typeof mod.getAtiByDisposition, 'function', 'Should export getAtiByDisposition');
    assert.equal(typeof mod.getAtiDepartmentStats, 'function', 'Should export getAtiDepartmentStats');
    assert.equal(typeof mod.initializeAtiTable, 'function', 'Should export initializeAtiTable');
    assert.equal(typeof mod.fetchAtiReleases, 'function', 'Should export fetchAtiReleases');
    assert.equal(typeof mod.fetchAllAtiReleases, 'function', 'Should export fetchAllAtiReleases');
  });
});
