// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('qc-health Module', () => {
  it('has required exports', async () => {
    const mod = await import('../qc-health/index.js');
    assert.equal(typeof mod.initializeQCHealthTable, 'function');
    assert.equal(typeof mod.searchQCHealthRecords, 'function');
    assert.equal(typeof mod.ingestQCHealthData, 'function');
    assert.equal(typeof mod.ingestAllQCHealth, 'function');
  });
});
