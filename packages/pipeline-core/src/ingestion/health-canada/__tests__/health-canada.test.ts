// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('health-canada Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestHealthCanada, 'function', 'Should export ingestHealthCanada');
    assert.equal(typeof mod.searchHealthCanadaRecords, 'function', 'Should export searchHealthCanadaRecords');
    assert.equal(typeof mod.getHealthCanadaRecallsBySeverity, 'function', 'Should export getHealthCanadaRecallsBySeverity');
  });
});
