// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('federal Module', () => {
  it('has required exports', async () => {
    const mod = await import('../federal/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllFederalDeep, 'function', 'Should export ingestAllFederalDeep');
  });
});
