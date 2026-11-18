// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('proactive-disclosure Module', () => {
  it('has required exports', async () => {
    const mod = await import('../proactive-disclosure/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestProactiveDisclosure, 'function', 'Should export ingestProactiveDisclosure');
    assert.equal(typeof mod.searchProactiveDisclosure, 'function', 'Should export searchProactiveDisclosure');
    assert.equal(typeof mod.getContractsByVendor, 'function', 'Should export getContractsByVendor');
    assert.equal(typeof mod.getContractsByDepartment, 'function', 'Should export getContractsByDepartment');
    assert.equal(typeof mod.getTopContracts, 'function', 'Should export getTopContracts');
    assert.equal(typeof mod.getDepartmentStats, 'function', 'Should export getDepartmentStats');
    assert.equal(typeof mod.initializePDTable, 'function', 'Should export initializePDTable');
    assert.equal(typeof mod.fetchProactiveDisclosure, 'function', 'Should export fetchProactiveDisclosure');
    assert.equal(typeof mod.fetchAllProactiveDisclosure, 'function', 'Should export fetchAllProactiveDisclosure');
  });
});
