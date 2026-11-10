// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('worldbank-wdi Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestWDIIndicator, 'function');
    assert.equal(typeof mod.getCountryProfile, 'function');
    assert.equal(typeof mod.compareCountries, 'function');
  });

  it('has CORE_INDICATORS constant', async () => {
    const mod = await import('../index.js');
    assert.ok(Array.isArray(mod.CORE_INDICATORS));
    assert.ok(mod.CORE_INDICATORS.length > 0);
  });

  it('parser parses indicator data correctly', async () => {
    const { parseIndicatorData } = await import('../parser.js');
    const mockData = [{
      indicator: { id: 'SP.POP.TOTL', value: 'Population total' },
      country: { id: 'CA', value: 'Canada' },
      countryiso3code: 'CAN',
      date: '2022',
      value: '38929902',
      unit: '',
      obs_status: '',
      decimal: 0,
    }];
    const results = parseIndicatorData(mockData, 'CAN');
    assert.equal(results.length, 1);
    assert.equal(results[0].country, 'CAN');
    assert.equal(results[0].year, 2022);
    assert.equal(results[0].value, 38929902);
    assert.equal(results[0].indicatorCode, 'SP.POP.TOTL');
    assert.ok(results[0].id);
  });
});
