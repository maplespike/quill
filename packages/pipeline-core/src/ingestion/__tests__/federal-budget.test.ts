// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('federal-budget Module', () => {
  it('has required exports', async () => {
    const mod = await import('../federal-budget/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestFederalBudget, 'function', 'Should export ingestFederalBudget');
    assert.equal(typeof mod.ingestAllFederalBudget, 'function', 'Should export ingestAllFederalBudget');
    assert.equal(typeof mod.searchFederalBudget, 'function', 'Should export searchFederalBudget');
    assert.equal(typeof mod.fetchAllBudgetData, 'function', 'Should export fetchAllBudgetData');
    assert.equal(typeof mod.fetchBudgetData, 'function', 'Should export fetchBudgetData');
    assert.equal(typeof mod.fetchPublicAccounts, 'function', 'Should export fetchPublicAccounts');
    assert.equal(typeof mod.fetchFiscalMonitor, 'function', 'Should export fetchFiscalMonitor');
    assert.equal(typeof mod.fetchDepartmentalPlans, 'function', 'Should export fetchDepartmentalPlans');
  });
});
