// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('uk-ons Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestSeries, 'function');
    assert.equal(typeof mod.ingestAllOns, 'function');
    assert.equal(typeof mod.ingestByTopic, 'function');
    assert.equal(typeof mod.healthCheck, 'function');
  });
});
