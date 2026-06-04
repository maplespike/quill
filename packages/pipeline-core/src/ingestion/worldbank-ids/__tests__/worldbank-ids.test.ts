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

  it('has CORE_IDS_INDICATORS constant', async () => {
    const mod = await import('../index.js');
    assert.ok(Array.isArray(mod.CORE_IDS_INDICATORS));
    assert.ok(mod.CORE_IDS_INDICATORS.length > 0);
  });

  it('has IDS_TOPICS constant', async () => {
    const mod = await import('../index.js');
    assert.ok(mod.IDS_TOPICS);
    assert.ok(Object.keys(mod.IDS_TOPICS).length > 0);
  });
});

describe('worldbank-ids Parser', () => {
  it('parseIdsDatum parses a valid World Bank API datum', async () => {
    const { parseIdsDatum } = await import('../parser.js');

    const mockDatum = {
      indicator: { id: 'DT.DOD.DLXF.CD', value: 'External debt stocks' },
      country: { id: 'CA', value: 'Canada' },
      countryiso3code: 'CAN',
      date: '2022',
      value: 500000,
      unit: '',
      obs_status: '',
      decimal: 0,
    };

    const result = parseIdsDatum(mockDatum, 'CAN');
    assert.ok(result);
    assert.equal(result!.country, 'CAN');
    assert.equal(result!.year, 2022);
    assert.equal(result!.value, 500000);
    assert.equal(result!.indicatorCode, 'DT.DOD.DLXF.CD');
    assert.ok(result!.id);
  });

  it('parseIdsDatum returns null for null value', async () => {
    const { parseIdsDatum } = await import('../parser.js');

    const mockDatum = {
      indicator: { id: 'DT.DOD.DLXF.CD', value: 'External debt stocks' },
      country: { id: 'CA', value: 'Canada' },
      countryiso3code: 'CAN',
      date: '2022',
      value: null,
      unit: '',
      obs_status: '',
      decimal: 0,
    };

    const result = parseIdsDatum(mockDatum, 'CAN');
    assert.equal(result, null);
  });

  it('parseIdsData filters out null entries', async () => {
    const { parseIdsData } = await import('../parser.js');

    const mockData = [
      {
        indicator: { id: 'DT.DOD.DLXF.CD', value: 'Debt' },
        country: { id: 'CA', value: 'Canada' },
        countryiso3code: 'CAN',
        date: '2022',
        value: 500000,
        unit: '',
        obs_status: '',
        decimal: 0,
      },
      {
        indicator: { id: 'DT.DOD.DLXF.CD', value: 'Debt' },
        country: { id: 'CA', value: 'Canada' },
        countryiso3code: 'CAN',
        date: '2021',
        value: null,
        unit: '',
        obs_status: '',
        decimal: 0,
      },
    ];

    const results = parseIdsData(mockData, 'CAN');
    assert.equal(results.length, 1);
    assert.equal(results[0].year, 2022);
  });

  it('buildCountryDebtProfile builds profile from indicator map', async () => {
    const { buildCountryDebtProfile } = await import('../parser.js');

    const indicatorData = new Map<string, any[]>();
    indicatorData.set('DT.DOD.DLXF.CD', [
      {
        indicator: { id: 'DT.DOD.DLXF.CD', value: 'Debt' },
        country: { id: 'CA', value: 'Canada' },
        countryiso3code: 'CAN',
        date: '2022',
        value: 500000,
        unit: '',
        obs_status: '',
        decimal: 0,
      },
    ]);

    const profile = buildCountryDebtProfile('CAN', indicatorData);
    assert.equal(profile.country, 'CAN');
    assert.equal(profile.indicators.length, 1);
    assert.ok(profile.lastUpdated);
  });

  it('buildIdsComparison groups values by country', async () => {
    const { buildIdsComparison } = await import('../parser.js');

    const dataByCountry = new Map<string, any[]>();
    dataByCountry.set('CAN', [
      {
        indicator: { id: 'DT.DOD.DLXF.CD', value: 'Debt' },
        country: { id: 'CA', value: 'Canada' },
        countryiso3code: 'CAN',
        date: '2022',
        value: 500000,
        unit: '',
        obs_status: '',
        decimal: 0,
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
        obs_status: '',
        decimal: 0,
      },
    ]);

    const comparison = buildIdsComparison('DT.DOD.DLXF.CD', dataByCountry);
    assert.equal(comparison.indicatorCode, 'DT.DOD.DLXF.CD');
    assert.equal(comparison.entries.length, 2);
    assert.ok(comparison.lastUpdated);
  });

  it('analyzeIdsTrend detects increasing trend', async () => {
    const { analyzeIdsTrend } = await import('../parser.js');

    const values = [
      { id: 'CAN:DT.DOD.DLXF.CD:2020', country: 'CAN', indicatorCode: 'DT.DOD.DLXF.CD', year: 2020, value: 400000 },
      { id: 'CAN:DT.DOD.DLXF.CD:2021', country: 'CAN', indicatorCode: 'DT.DOD.DLXF.CD', year: 2021, value: 450000 },
      { id: 'CAN:DT.DOD.DLXF.CD:2022', country: 'CAN', indicatorCode: 'DT.DOD.DLXF.CD', year: 2022, value: 500000 },
    ];

    const trend = analyzeIdsTrend(values);
    assert.equal(trend.trend, 'increasing');
    assert.equal(trend.startYear, 2020);
    assert.equal(trend.endYear, 2022);
    assert.ok(trend.changeRate > 0);
    assert.equal(trend.indicatorCode, 'DT.DOD.DLXF.CD');
    assert.equal(trend.country, 'CAN');
  });

  it('analyzeIdsTrend detects decreasing trend', async () => {
    const { analyzeIdsTrend } = await import('../parser.js');

    const values = [
      { id: 'CAN:DT.DOD.DLXF.CD:2020', country: 'CAN', indicatorCode: 'DT.DOD.DLXF.CD', year: 2020, value: 500000 },
      { id: 'CAN:DT.DOD.DLXF.CD:2021', country: 'CAN', indicatorCode: 'DT.DOD.DLXF.CD', year: 2021, value: 400000 },
    ];

    const trend = analyzeIdsTrend(values);
    assert.equal(trend.trend, 'decreasing');
    assert.ok(trend.changeRate < 0);
  });

  it('analyzeIdsTrend returns no_data for < 2 points', async () => {
    const { analyzeIdsTrend } = await import('../parser.js');

    const values = [
      { id: 'CAN:DT.DOD.DLXF.CD:2022', country: 'CAN', indicatorCode: 'DT.DOD.DLXF.CD', year: 2022, value: 500000 },
    ];

    const trend = analyzeIdsTrend(values);
    assert.equal(trend.trend, 'no_data');
    assert.equal(trend.changeRate, 0);
  });

  it('analyzeIdsTrend returns stable for near-zero change', async () => {
    const { analyzeIdsTrend } = await import('../parser.js');

    const values = [
      { id: 'CAN:DT.DOD.DLXF.CD:2020', country: 'CAN', indicatorCode: 'DT.DOD.DLXF.CD', year: 2020, value: 500000 },
      { id: 'CAN:DT.DOD.DLXF.CD:2021', country: 'CAN', indicatorCode: 'DT.DOD.DLXF.CD', year: 2021, value: 500001 },
    ];

    const trend = analyzeIdsTrend(values);
    assert.equal(trend.trend, 'stable');
  });
});
