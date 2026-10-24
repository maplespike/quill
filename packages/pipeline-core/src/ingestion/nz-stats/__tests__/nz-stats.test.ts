// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('nz-stats Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestDataset, 'function');
    assert.equal(typeof mod.ingestAllSnz, 'function');
    assert.equal(typeof mod.ingestByTopic, 'function');
    assert.equal(typeof mod.healthCheck, 'function');
  });
});
