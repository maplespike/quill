// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('on-education Module', () => {
  it('has required exports', async () => {
    const mod = await import('../on-education/index.js');
    assert.equal(typeof mod.ingestOnEducationData, 'function');
    assert.equal(typeof mod.searchOnEducationRecords, 'function');
  });
});
