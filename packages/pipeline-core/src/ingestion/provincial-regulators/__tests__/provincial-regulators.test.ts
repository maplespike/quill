// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('provincial-regulators Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllRegulators, 'function', 'Should export ingestAllRegulators');
    assert.equal(typeof mod.getRegulatorCoverage, 'function', 'Should export getRegulatorCoverage');
  });
});
