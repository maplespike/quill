// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('real-time-feeds Module', () => {
  it('has required exports', async () => {
    const mod = await import('../real-time-feeds/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllRealtime, 'function', 'Should export ingestAllRealtime');
    assert.ok(mod.REALTIME_SOURCES, 'Should export REALTIME_SOURCES');
  });
});
