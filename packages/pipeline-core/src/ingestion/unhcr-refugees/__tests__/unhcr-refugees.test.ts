// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('unhcr-refugees Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.fetchRefugeeDataByCountry, 'function');
    assert.equal(typeof mod.fetchRefugeeDataMultiCountry, 'function');
  });

  it('parser parses population record correctly', async () => {
    const { parsePopulationRecord } = await import('../parser.js');
    const result = parsePopulationRecord({
      iso3: 'CAN',
      year: 2023,
      population_type: "Refugees (under UNHCR's mandate)",
      population_value: 150000,
    });
    assert.ok(result);
    assert.equal(result?.populationType, 'refugees');
    assert.equal(result?.value, 150000);
    assert.equal(result?.countryCode, 'CAN');
  });

  it('parser returns null for unknown population type', async () => {
    const { parsePopulationRecord } = await import('../parser.js');
    const result = parsePopulationRecord({
      iso3: 'CAN',
      population_type: 'Unknown',
      population_value: 100,
    });
    assert.equal(result, null);
  });
});
