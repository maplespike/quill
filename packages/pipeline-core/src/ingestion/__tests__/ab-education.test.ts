// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ab-education Module', () => {
  it('has required exports', async () => {
    const mod = await import('../ab-education/index.js');
    assert.equal(typeof mod.ingestAbEducationData, 'function');
    assert.equal(typeof mod.searchAbEducationRecords, 'function');
  });
});
