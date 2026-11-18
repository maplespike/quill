// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('worldbank-wgi Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestWgiIndicator, 'function');
    assert.equal(typeof mod.getWgiCountrySnapshot, 'function');
    assert.equal(typeof mod.compareWgiCountries, 'function');
    assert.equal(typeof mod.analyzeWgiIndicatorTrend, 'function');
  });

  it('has WGI_INDICATORS constant with 6 governance dimensions', async () => {
    const mod = await import('../index.js');
    assert.ok(Array.isArray(mod.WGI_INDICATORS));
    assert.equal(mod.WGI_INDICATORS.length, 6);
  });
});

describe('worldbank-wgi Parser', () => {
  it('parseWgiRecords parses a valid World Bank API datum', async () => {
    const { parseWgiRecords } = await import('../parser.js');

    const mockDatum = [
      {
        indicator: { id: 'VA.EST', value: 'Voice and Accountability: Estimate' },
        country: { id: 'CA', value: 'Canada' },
        countryiso3code: 'CAN',
        date: '2022',
        value: '1.45',
        unit: '',
      },
    ];

    const result = parseWgiRecords(mockDatum, 'CAN');
    assert.ok(result.length >= 1);
    const first = result[0];
    assert.equal(first.countryiso3code, 'CAN');
    assert.equal(first.year, 2022);
    assert.equal(first.value, 1.45);
    assert.equal(first.indicatorCode, 'VA.EST');
  });

  it('parseWgiRecords skips null years', async () => {
    const { parseWgiRecords } = await import('../parser.js');
    const result = parseWgiRecords([{ date: 'n/a', value: 1.0, indicator: { id: 'VA.EST' } }], 'CAN');
    assert.equal(result.length, 0);
  });

  it('buildCountrySnapshot builds snapshot from indicator map', async () => {
    const { buildCountrySnapshot } = await import('../parser.js');

    const indicatorData = new Map<string, any[]>();
    indicatorData.set('VA.EST', [
      {
        indicator: { id: 'VA.EST', value: 'VA Estimate' },
        country: { id: 'CA', value: 'Canada' },
        countryiso3code: 'CAN',
        date: '2022',
        value: '1.45',
        unit: '',
      },
    ]);

    const snapshot = buildCountrySnapshot('CAN', indicatorData);
    assert.equal(snapshot.country, 'CAN');
    assert.ok(snapshot.indicators['VA.EST']);
    assert.equal(snapshot.year, 2022);
    assert.equal(snapshot.overallScore, 1.45);
  });

  it('buildComparison groups values by country', async () => {
    const { buildComparison } = await import('../parser.js');

    const dataByCountry = new Map<string, any[]>();
    dataByCountry.set('CAN', [
      {
        indicator: { id: 'VA.EST', value: 'VA Estimate' },
        country: { id: 'CA', value: 'Canada' },
        countryiso3code: 'CAN',
        date: '2022',
        value: '1.45',
        unit: '',
      },
    ]);
    dataByCountry.set('NOR', [
      {
        indicator: { id: 'VA.EST', value: 'VA Estimate' },
        country: { id: 'NO', value: 'Norway' },
        countryiso3code: 'NOR',
        date: '2022',
        value: '1.68',
        unit: '',
      },
    ]);

    const comparison = buildComparison('VA.EST', dataByCountry);
    assert.equal(comparison.indicatorCode, 'VA.EST');
    assert.equal(Object.keys(comparison.countries).length, 2);
  });

  it('analyzeTrend detects improving trend', async () => {
    const { analyzeTrend } = await import('../parser.js');

    const values = [
      { id: 'CAN:VA.EST:2018', country: 'CAN', indicatorCode: 'VA.EST', year: 2018, value: 1.2 },
      { id: 'CAN:VA.EST:2020', country: 'CAN', indicatorCode: 'VA.EST', year: 2020, value: 1.35 },
      { id: 'CAN:VA.EST:2022', country: 'CAN', indicatorCode: 'VA.EST', year: 2022, value: 1.45 },
    ];

    const trend = analyzeTrend(values);
    assert.equal(trend.trend, 'improving');
    assert.equal(trend.latestValue, 1.45);
    assert.equal(trend.earliestValue, 1.2);
  });

  it('analyzeTrend detects worsening trend', async () => {
    const { analyzeTrend } = await import('../parser.js');

    const values = [
      { id: 'MEX:PV.EST:2018', country: 'MEX', indicatorCode: 'PV.EST', year: 2018, value: -0.5 },
      { id: 'MEX:PV.EST:2022', country: 'MEX', indicatorCode: 'PV.EST', year: 2022, value: -0.9 },
    ];

    const trend = analyzeTrend(values);
    assert.equal(trend.trend, 'declining');
  });

  it('analyzeTrend returns stable for < 2 valid points', async () => {
    const { analyzeTrend } = await import('../parser.js');

    const values = [
      { id: 'CAN:VA.EST:2022', country: 'CAN', indicatorCode: 'VA.EST', year: 2022, value: 1.45 },
    ];

    const trend = analyzeTrend(values);
    assert.equal(trend.trend, 'stable');
  });

  it('analyzeTrend handles negative WGI values (range -2.5 to +2.5)', async () => {
    const { analyzeTrend } = await import('../parser.js');

    const values = [
      { id: 'ZAF:CC.EST:2018', country: 'ZAF', indicatorCode: 'CC.EST', year: 2018, value: -0.1 },
      { id: 'ZAF:CC.EST:2022', country: 'ZAF', indicatorCode: 'CC.EST', year: 2022, value: -0.05 },
    ];

    const trend = analyzeTrend(values);
    assert.equal(trend.trend, 'improving');
  });
});
