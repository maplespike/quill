// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('bc-education Module', () => {
  it('has required exports', async () => {
    const mod = await import('../bc-education/index.js');
    assert.equal(typeof mod.ingestBcEducationData, 'function');
    assert.equal(typeof mod.searchBcEducationRecords, 'function');
  });
});
