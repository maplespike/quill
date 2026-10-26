// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ilo-labour Module', () => {
  it('constants module loads with correct exports', async () => {
    const mod = await import('../constants.js');
    assert.ok(mod.ILO_API_BASE);
    assert.ok(Array.isArray(mod.ILO_INDICATORS));
    assert.ok(mod.ILO_INDICATORS.length > 0);
    assert.ok(mod.ILO_TOPICS);
    assert.equal(typeof mod.buildIndicatorUrl, 'function');
  });

  it('ILO_INDICATORS has employment and unemployment indicators', async () => {
    const { ILO_INDICATORS } = await import('../constants.js');
    const ids = ILO_INDICATORS.map((i: { id: string }) => i.id);
    assert.ok(ids.includes('UNE_TPOP_RT_A'), 'should include unemployment rate');
    assert.ok(ids.includes('EMP_TEMP_SEX_AGE_RT_A'), 'should include employment');
    assert.ok(ids.includes('LF_2EMP_SEX_AGE_NB_A'), 'should include labour force');
  });

  it('buildIndicatorUrl produces valid URL', async () => {
    const { buildIndicatorUrl } = await import('../constants.js');
    const url = buildIndicatorUrl('UNE_TPOP_RT_A', 'CAN');
    assert.ok(url.includes('UNE_TPOP_RT_A'));
    assert.ok(url.includes('CAN'));
    assert.ok(url.startsWith('https://www.ilo.org/ilostat-api-dev/api'));
  });

  it('parser parses empty data', async () => {
    const { parseIloResponse } = await import('../parser.js');
    const result = await parseIloResponse(undefined, 'TEST', 'Test');
    assert.equal(result.length, 0);
  });

  it('parser parses valid observations', async () => {
    const { parseIloResponse } = await import('../parser.js');
    const data = [
      {
        indicator: { label: 'Unemployment rate' },
        geo: { label: 'Canada', code: 'CAN' },
        time: 2023,
        value: 5.4,
        unit: { label: 'percentage' },
        source: { label: 'ILO' },
      },
    ];
    const result = await parseIloResponse(data, 'UNE_TPOP_RT_A', 'Unemployment rate');
    assert.equal(result.length, 1);
    assert.equal(result[0].country, 'Canada');
    assert.equal(result[0].value, 5.4);
    assert.equal(result[0].year, 2023);
    assert.equal(result[0].indicatorCode, 'UNE_TPOP_RT_A');
  });

  it('searchIloRecords filters by keyword', async () => {
    const { searchIloRecords } = await import('../index.js');
    const records = [
      { id: '1', indicatorCode: 'UNE_TPOP_RT_A', indicatorName: 'Unemployment rate', country: 'Canada', countryCode: 'CAN', year: 2023, value: 5.4, unit: 'percentage', source: 'ILO' },
      { id: '2', indicatorCode: 'EMP_TEMP_SEX_AGE_RT_A', indicatorName: 'Employment rate', country: 'Canada', countryCode: 'CAN', year: 2023, value: 61.2, unit: 'percentage', source: 'ILO' },
    ];
    const result = searchIloRecords(records, 'unemployment');
    assert.equal(result.length, 1);
    assert.equal(result[0].indicatorCode, 'UNE_TPOP_RT_A');
  });

  it('types module exports correctly', async () => {
    const types = await import('../types.js');
    // Type-only module — should at least load
    assert.ok(types);
  });
});
