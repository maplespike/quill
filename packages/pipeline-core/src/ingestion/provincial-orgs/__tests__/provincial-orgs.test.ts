// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('provincial-orgs Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllProvincialOrgs, 'function', 'Should export ingestAllProvincialOrgs');
    assert.equal(typeof mod.ingestProvinceOrgs, 'function', 'Should export ingestProvinceOrgs');
    assert.equal(typeof mod.searchProvincialOrg, 'function', 'Should export searchProvincialOrg');
  });
});
