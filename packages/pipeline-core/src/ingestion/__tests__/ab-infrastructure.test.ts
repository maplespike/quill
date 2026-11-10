// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ab-infrastructure Module', () => {
  it('has required exports', async () => {
    const mod = await import('../ab-infrastructure/index.js');
    assert.equal(typeof mod.ingestAbInfrastructureData, 'function');
    assert.equal(typeof mod.searchAbInfrastructureRecords, 'function');
  });
});
