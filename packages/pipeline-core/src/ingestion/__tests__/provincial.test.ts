// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('provincial Module', () => {
  it('has required exports', async () => {
    const mod = await import('../provincial/index.js');
    assert.ok(mod);
    assert.equal(typeof mod.ingestAllProvincialDeep, 'function');
    assert.equal(typeof mod.parseProvincialDataset, 'function');
    assert.equal(typeof mod.parseProvincialDatasets, 'function');
    assert.equal(typeof mod.normalizeDate, 'function');
    assert.equal(typeof mod.parseNumeric, 'function');
  });

  it('normalizeDate handles various formats', async () => {
    const parser = await import('../provincial/parser.js');
    assert.equal(parser.normalizeDate('2024-01-15'), '2024-01-15');
    assert.equal(parser.normalizeDate('2024/01/15'), '2024-01-15');
    assert.equal(parser.normalizeDate(''), null);
    assert.equal(parser.normalizeDate(null), null);
  });

  it('parseNumeric handles various formats', async () => {
    const parser = await import('../provincial/parser.js');
    assert.equal(parser.parseNumeric('1,234.56'), 1234.56);
    assert.equal(parser.parseNumeric('500'), 500);
    assert.equal(parser.parseNumeric(''), null);
    assert.equal(parser.parseNumeric(null), null);
  });
});
