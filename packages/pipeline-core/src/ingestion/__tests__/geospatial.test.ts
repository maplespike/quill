// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('geospatial Module', () => {
  it('has required exports', async () => {
    const mod = await import('../geospatial/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllGeospatial, 'function', 'Should export ingestAllGeospatial');
    assert.equal(typeof mod.ingestLodeDatabaseById, 'function', 'Should export ingestLodeDatabaseById');
    assert.equal(typeof mod.ingestAllLode, 'function', 'Should export ingestAllLode');
    assert.equal(typeof mod.searchLode, 'function', 'Should export searchLode');
    assert.equal(typeof mod.listLodeDatabases, 'function', 'Should export listLodeDatabases');
    assert.equal(typeof mod.getLodeDatabaseInfo, 'function', 'Should export getLodeDatabaseInfo');
    assert.ok(mod.LODE_DATABASES, 'Should export LODE_DATABASES');
    assert.ok(mod.LODE_SOURCE_NAMES, 'Should export LODE_SOURCE_NAMES');
  });
});
