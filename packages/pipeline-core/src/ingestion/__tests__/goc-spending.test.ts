// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('goc-spending Module', () => {
  it('has required exports', async () => {
    const mod = await import('../goc-spending/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllGoCSpending, 'function', 'Should export ingestAllGoCSpending');
    assert.equal(typeof mod.fetchContracts, 'function', 'Should export fetchContracts');
    assert.equal(typeof mod.listDataFiles, 'function', 'Should export listDataFiles');
    assert.ok(mod.GOC_CONTRACTS_DDL, 'Should export GOC_CONTRACTS_DDL');
    assert.ok(mod.GOC_DEPT_SPENDING_DDL, 'Should export GOC_DEPT_SPENDING_DDL');
  });
});
