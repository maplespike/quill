// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('worldbank-ids Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestIdsIndicator, 'function');
    assert.equal(typeof mod.getIdsCountryDebtProfile, 'function');
    assert.equal(typeof mod.compareIdsCountries, 'function');
    assert.equal(typeof mod.analyzeIdsIndicatorTrend, 'function');
    assert.equal(typeof mod.fetchIdsTopicData, 'function');
  });

  it('has CORE_INDICATORS constant', async () => {
    const mod = await import('../index.js');
    assert.ok(Array.isArray(mod.CORE_INDICATORS));
    assert.ok(mod.CORE_INDICATORS.length > 0);
  });

  it('has TOPIC_INDICATORS constant', async () => {
    const mod = await import('../index.js');
    assert.ok(mod.TOPIC_INDICATORS);
    assert.ok(Object.keys(mod.TOPIC_INDICATORS).length > 0);
  });
});

describe('worldbank-ids Parser', () => {
  it('parseIndicatorData parses a valid World Bank API datum', async () => {
    const { parseIndicatorData } = await import('../parser.js');

    const mockDatum = [
      {
        indicator: { id: 'DT.DOD.DLXF.CD', value: 'External debt stocks' },
        country: { id: 'CA', value: 'Canada' },
        countryiso3code: 'CAN',
        date: '2022',
        value: 500000,
        unit: '',
      },
    ];

    const result = parseIndicatorData(mockDatum, 'CAN');
    assert.ok(result.length >= 1);
    const first = result[0];
    assert.equal(first.countryiso3code, 'CAN');
    assert.equal(first.year, 2022);
    assert.equal(first.value, 500000);
    assert.equal(first.indicatorCode, 'DT.DOD.DLXF.CD');
  });

  it('parseIndicatorData skips null years', async () => {
    const { parseIndicatorData } = await import('../parser.js');
    const result = parseIndicatorData([{ date: 'n/a', value: 100, indicator: { id: 'X' } }], 'CAN');
    assert.equal(result.length, 0);
  });

  it('buildCountryProfile builds profile from indicator map', async () => {
    const { buildCountryProfile } = await import('../parser.js');

    const indicatorData = new Map<string, any[]>();
    indicatorData.set('DT.DOD.DLXF.CD', [
      {
        indicator: { id: 'DT.DOD.DLXF.CD', value: 'Debt' },
        country: { id: 'CA', value: 'Canada' },
        countryiso3code: 'CAN',
        date: '2022',
        value: 500000,
        unit: '',
      },
    ]);

    const profile = buildCountryProfile('CAN', indicatorData);
    assert.equal(profile.country, 'CAN');
    assert.ok(profile.indicators['DT.DOD.DLXF.CD']);
    assert.equal(profile.latestYear, 2022);
  });

  it('buildComparison groups values by country', async () => {
    const { buildComparison } = await import('../parser.js');

    const dataByCountry = new Map<string, any[]>();
    dataByCountry.set('CAN', [
      {
        indicator: { id: 'DT.DOD.DLXF.CD', value: 'Debt' },
        country: { id: 'CA', value: 'Canada' },
        countryiso3code: 'CAN',
        date: '2022',
        value: 500000,
        unit: '',
      },
    ]);
    dataByCountry.set('MEX', [
      {
        indicator: { id: 'DT.DOD.DLXF.CD', value: 'Debt' },
        country: { id: 'MX', value: 'Mexico' },
        countryiso3code: 'MEX',
        date: '2022',
        value: 300000,
        unit: '',
      },
    ]);

    const comparison = buildComparison('DT.DOD.DLXF.CD', dataByCountry);
    assert.equal(comparison.indicatorCode, 'DT.DOD.DLXF.CD');
    assert.equal(Object.keys(comparison.countries).length, 2);
  });

  it('analyzeTrend detects increasing trend', async () => {
    const { analyzeTrend } = await import('../parser.js');

    const values = [
      { id: 'CAN:DT.DOD.DLXF.CD:2020', country: 'CAN', indicatorCode: 'DT.DOD.DLXF.CD', year: 2020, value: 400000 },
      { id: 'CAN:DT.DOD.DLXF.CD:2021', country: 'CAN', indicatorCode: 'DT.DOD.DLXF.CD', year: 2021, value: 450000 },
      { id: 'CAN:DT.DOD.DLXF.CD:2022', country: 'CAN', indicatorCode: 'DT.DOD.DLXF.CD', year: 2022, value: 500000 },
    ];

    const trend = analyzeTrend(values);
    assert.equal(trend.trend, 'increasing');
    assert.equal(trend.latestValue, 500000);
    assert.equal(trend.earliestValue, 400000);
  });

  it('analyzeTrend detects decreasing trend', async () => {
    const { analyzeTrend } = await import('../parser.js');

    const values = [
      { id: 'CAN:DT.DOD.DLXF.CD:2020', country: 'CAN', indicatorCode: 'DT.DOD.DLXF.CD', year: 2020, value: 500000 },
      { id: 'CAN:DT.DOD.DLXF.CD:2021', country: 'CAN', indicatorCode: 'DT.DOD.DLXF.CD', year: 2021, value: 400000 },
    ];

    const trend = analyzeTrend(values);
    assert.equal(trend.trend, 'decreasing');
  });

  it('analyzeTrend returns stable for < 2 valid points', async () => {
    const { analyzeTrend } = await import('../parser.js');

    const values = [
      { id: 'CAN:DT.DOD.DLXF.CD:2022', country: 'CAN', indicatorCode: 'DT.DOD.DLXF.CD', year: 2022, value: 500000 },
    ];

    const trend = analyzeTrend(values);
    assert.equal(trend.trend, 'stable');
  });
});
