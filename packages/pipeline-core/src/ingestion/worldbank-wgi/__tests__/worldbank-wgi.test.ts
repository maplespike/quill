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

  it('has CORE_WGI_INDICATORS constant', async () => {
    const mod = await import('../index.js');
    assert.ok(Array.isArray(mod.CORE_WGI_INDICATORS));
    assert.ok(mod.CORE_WGI_INDICATORS.length > 0);
  });

  it('has WGI_INDICATORS constant with 6 governance dimensions', async () => {
    const mod = await import('../index.js');
    assert.ok(mod.WGI_INDICATORS);
    assert.equal(Object.keys(mod.WGI_INDICATORS).length, 6);
  });
});

describe('worldbank-wgi Parser', () => {
  it('parseWgiDatum parses a valid World Bank API datum', async () => {
    const { parseWgiDatum } = await import('../parser.js');

    const mockDatum = {
      indicator: { id: 'VA.EST', value: 'Voice and Accountability: Estimate' },
      country: { id: 'CA', value: 'Canada' },
      countryiso3code: 'CAN',
      date: '2022',
      value: '1.45',
      unit: '',
      obs_status: '',
      decimal: 2,
    };

    const result = parseWgiDatum(mockDatum, 'CAN');
    assert.ok(result);
    assert.equal(result!.country, 'CAN');
    assert.equal(result!.year, 2022);
    assert.equal(result!.value, 1.45);
    assert.equal(result!.indicatorCode, 'VA.EST');
    assert.ok(result!.id);
  });

  it('parseWgiDatum returns null for null value', async () => {
    const { parseWgiDatum } = await import('../parser.js');

    const mockDatum = {
      indicator: { id: 'VA.EST', value: 'VA Estimate' },
      country: { id: 'CA', value: 'Canada' },
      countryiso3code: 'CAN',
      date: '2022',
      value: null,
      unit: '',
      obs_status: '',
      decimal: 0,
    };

    const result = parseWgiDatum(mockDatum, 'CAN');
    assert.equal(result, null);
  });

  it('parseWgiData filters out null entries', async () => {
    const { parseWgiData } = await import('../parser.js');

    const mockData = [
      {
        indicator: { id: 'VA.EST', value: 'VA Estimate' },
        country: { id: 'CA', value: 'Canada' },
        countryiso3code: 'CAN',
        date: '2022',
        value: '1.45',
        unit: '',
        obs_status: '',
        decimal: 2,
      },
      {
        indicator: { id: 'VA.EST', value: 'VA Estimate' },
        country: { id: 'CA', value: 'Canada' },
        countryiso3code: 'CAN',
        date: '2021',
        value: null,
        unit: '',
        obs_status: '',
        decimal: 0,
      },
    ];

    const results = parseWgiData(mockData, 'CAN');
    assert.equal(results.length, 1);
    assert.equal(results[0].year, 2022);
  });

  it('mergeWgiBounds merges stderr, lower, upper, percentile into estimates', async () => {
    const { mergeWgiBounds } = await import('../parser.js');

    const estimates = [
      { id: 'CAN:VA.EST:2022', country: 'CAN', indicatorCode: 'VA.EST', year: 2022, value: 1.45 },
    ];

    const boundsData = new Map<string, any[]>();
    boundsData.set('VA.EST.STD.ERR', [
      { id: 'CAN:VA.EST.STD.ERR:2022', country: 'CAN', indicatorCode: 'VA.EST.STD.ERR', year: 2022, value: 0.12 },
    ]);
    boundsData.set('VA.EST.LO', [
      { id: 'CAN:VA.EST.LO:2022', country: 'CAN', indicatorCode: 'VA.EST.LO', year: 2022, value: 1.21 },
    ]);
    boundsData.set('VA.EST.HI', [
      { id: 'CAN:VA.EST.HI:2022', country: 'CAN', indicatorCode: 'VA.EST.HI', year: 2022, value: 1.69 },
    ]);
    boundsData.set('VA.EST.PERCTRL', [
      { id: 'CAN:VA.EST.PERCTRL:2022', country: 'CAN', indicatorCode: 'VA.EST.PERCTRL', year: 2022, value: 92 },
    ]);

    const merged = mergeWgiBounds(estimates, boundsData);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].value, 1.45);
    assert.equal(merged[0].stderr, 0.12);
    assert.equal(merged[0].lower, 1.21);
    assert.equal(merged[0].upper, 1.69);
    assert.equal(merged[0].percentile, 92);
  });

  it('buildWgiComparison groups values by country', async () => {
    const { buildWgiComparison } = await import('../parser.js');

    const dataByCountry = new Map<string, any[]>();
    dataByCountry.set('CAN', [
      {
        indicator: { id: 'VA.EST', value: 'VA Estimate' },
        country: { id: 'CA', value: 'Canada' },
        countryiso3code: 'CAN',
        date: '2022',
        value: '1.45',
        unit: '',
        obs_status: '',
        decimal: 2,
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
        obs_status: '',
        decimal: 2,
      },
    ]);

    const comparison = buildWgiComparison('VA.EST', dataByCountry);
    assert.equal(comparison.indicatorCode, 'VA.EST');
    assert.equal(comparison.entries.length, 2);
    assert.ok(comparison.lastUpdated);
  });

  it('analyzeWgiTrend detects improving trend', async () => {
    const { analyzeWgiTrend } = await import('../parser.js');

    const values = [
      { id: 'CAN:VA.EST:2018', country: 'CAN', indicatorCode: 'VA.EST', year: 2018, value: 1.2 },
      { id: 'CAN:VA.EST:2020', country: 'CAN', indicatorCode: 'VA.EST', year: 2020, value: 1.35 },
      { id: 'CAN:VA.EST:2022', country: 'CAN', indicatorCode: 'VA.EST', year: 2022, value: 1.45 },
    ];

    const trend = analyzeWgiTrend(values);
    assert.equal(trend.trend, 'improving');
    assert.equal(trend.startYear, 2018);
    assert.equal(trend.endYear, 2022);
    assert.ok(trend.changeRate > 0);
    assert.equal(trend.indicatorCode, 'VA.EST');
    assert.equal(trend.country, 'CAN');
  });

  it('analyzeWgiTrend detects worsening trend', async () => {
    const { analyzeWgiTrend } = await import('../parser.js');

    const values = [
      { id: 'MEX:PV.EST:2018', country: 'MEX', indicatorCode: 'PV.EST', year: 2018, value: -0.5 },
      { id: 'MEX:PV.EST:2022', country: 'MEX', indicatorCode: 'PV.EST', year: 2022, value: -0.9 },
    ];

    const trend = analyzeWgiTrend(values);
    assert.equal(trend.trend, 'worsening');
    assert.ok(trend.changeRate < 0);
  });

  it('analyzeWgiTrend returns no_data for < 2 points', async () => {
    const { analyzeWgiTrend } = await import('../parser.js');

    const values = [
      { id: 'CAN:VA.EST:2022', country: 'CAN', indicatorCode: 'VA.EST', year: 2022, value: 1.45 },
    ];

    const trend = analyzeWgiTrend(values);
    assert.equal(trend.trend, 'no_data');
    assert.equal(trend.changeRate, 0);
  });

  it('analyzeWgiTrend handles negative WGI values (range -2.5 to +2.5)', async () => {
    const { analyzeWgiTrend } = await import('../parser.js');

    const values = [
      { id: 'ZAF:CC.EST:2018', country: 'ZAF', indicatorCode: 'CC.EST', year: 2018, value: -0.1 },
      { id: 'ZAF:CC.EST:2022', country: 'ZAF', indicatorCode: 'CC.EST', year: 2022, value: -0.05 },
    ];

    const trend = analyzeWgiTrend(values);
    assert.equal(trend.trend, 'improving');
    assert.ok(trend.changeRate > 0);
  });

  it('analyzeWgiTrend returns stable for near-zero change', async () => {
    const { analyzeWgiTrend } = await import('../parser.js');

    const values = [
      { id: 'CAN:VA.EST:2020', country: 'CAN', indicatorCode: 'VA.EST', year: 2020, value: 1.45 },
      { id: 'CAN:VA.EST:2022', country: 'CAN', indicatorCode: 'VA.EST', year: 2022, value: 1.46 },
    ];

    const trend = analyzeWgiTrend(values);
    assert.equal(trend.trend, 'stable');
  });
});
