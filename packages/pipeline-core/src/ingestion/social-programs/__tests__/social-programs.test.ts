// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('social-programs Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllSocialPrograms, 'function', 'Should export ingestAllSocialPrograms');
    assert.equal(typeof mod.searchSocialPrograms, 'function', 'Should export searchSocialPrograms');
  });
});
