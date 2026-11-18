// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('energy Module', () => {
  it('has required exports', async () => {
    const mod = await import('../energy/index.js');
    assert.ok(mod);
    assert.equal(typeof mod.ingestOilProduction, 'function');
    assert.equal(typeof mod.ingestGasProduction, 'function');
    assert.equal(typeof mod.ingestElectricity, 'function');
    assert.equal(typeof mod.ingestMining, 'function');
    assert.equal(typeof mod.ingestAllEnergy, 'function');
    assert.equal(typeof mod.parseEnergyRecords, 'function');
    assert.equal(typeof mod.normalizeProvince, 'function');
    assert.equal(typeof mod.parseNumeric, 'function');
  });

  it('normalizeProvince maps correctly', async () => {
    const parser = await import('../energy/parser.js');
    assert.equal(parser.normalizeProvince('ON'), 'ON');
    assert.equal(parser.normalizeProvince('ontario'), 'ON');
    assert.equal(parser.normalizeProvince('BC'), 'BC');
    assert.equal(parser.normalizeProvince('british columbia'), 'BC');
    assert.equal(parser.normalizeProvince('QUEBEC'), 'QC');
    assert.equal(parser.normalizeProvince(null), null);
  });

  it('parseNumeric handles various formats', async () => {
    const parser = await import('../energy/parser.js');
    assert.equal(parser.parseNumeric('1,234.56'), 1234.56);
    assert.equal(parser.parseNumeric('500'), 500);
    assert.equal(parser.parseNumeric(''), null);
    assert.equal(parser.parseNumeric(null), null);
  });
});
