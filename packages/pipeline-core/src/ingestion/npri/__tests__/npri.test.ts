// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('npri Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestNpri, 'function', 'Should export ingestNpri');
    assert.equal(typeof mod.searchNpriRecords, 'function', 'Should export searchNpriRecords');
    assert.equal(typeof mod.getNpriByFacility, 'function', 'Should export getNpriByFacility');
  });
});
