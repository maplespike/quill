import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('eurostat Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestEurostatDataset, 'function');
    assert.equal(typeof mod.getEurostatCountryProfile, 'function');
    assert.equal(typeof mod.compareEurostatGeos, 'function');
    assert.equal(typeof mod.analyzeEurostatDatasetTrend, 'function');
  });

  it('has CORE_EUROSTAT_DATASETS constant', async () => {
    const mod = await import('../index.js');
    assert.ok(Array.isArray(mod.CORE_EUROSTAT_DATASETS));
    assert.ok(mod.CORE_EUROSTAT_DATASETS.length > 0);
  });

  it('has DEFAULT_GEOS constant', async () => {
    const mod = await import('../index.js');
    assert.ok(Array.isArray(mod.DEFAULT_GEOS));
    assert.ok(mod.DEFAULT_GEOS.length > 0);
  });
});

describe('eurostat Parser', () => {
  it('parseJsonStatResponse parses a valid JSON-stat response', async () => {
    const { parseJsonStatResponse } = await import('../parser.js');

    const mockJsonStat = {
      version: '2.0',
      class: 'dataset' as const,
      label: 'GDP per capita',
      id: ['time', 'geo', 'unit'],
      size: [2, 2, 1],
      dimension: {
        time: {
          label: 'Time',
          category: {
            index: { '2022': 0, '2023': 1 },
            label: { '2022': '2022', '2023': '2023' },
          },
        },
        geo: {
          label: 'Geography',
          category: {
            index: { DE: 0, FR: 1 },
            label: { DE: 'Germany', FR: 'France' },
          },
        },
        unit: {
          label: 'Unit',
          category: {
            index: { PC: 0 },
            label: { PC: 'Percentage' },
          },
        },
      },
      value: [100, 90, 110, 95],
    };

    const results = parseJsonStatResponse(mockJsonStat, 'nama_10_pc');
    assert.equal(results.length, 4);
    assert.equal(results[0].geo, 'DE');
    assert.equal(results[0].year, 2022);
    assert.equal(results[0].value, 100);
    assert.equal(results[0].indicatorCode, 'nama_10_pc');
    assert.equal(results[0].unit, 'PC');
    assert.ok(results[0].id);
  });

  it('parseJsonStatResponse skips null values', async () => {
    const { parseJsonStatResponse } = await import('../parser.js');

    const mockJsonStat = {
      version: '2.0',
      class: 'dataset' as const,
      id: ['time', 'geo'],
      size: [2, 2],
      dimension: {
        time: {
          label: 'Time',
          category: {
            index: { '2022': 0, '2023': 1 },
            label: { '2022': '2022', '2023': '2023' },
          },
        },
        geo: {
          label: 'Geography',
          category: {
            index: { DE: 0, FR: 1 },
            label: { DE: 'Germany', FR: 'France' },
          },
        },
      },
      value: [100, null, 110, 95],
    };

    const results = parseJsonStatResponse(mockJsonStat, 'test_ds');
    assert.equal(results.length, 3);
  });

  it('parseJsonStatResponse returns empty for missing dimensions', async () => {
    const { parseJsonStatResponse } = await import('../parser.js');

    const mockJsonStat = {
      version: '2.0',
      class: 'dataset' as const,
      id: ['time'], // missing geo
      size: [2],
      dimension: {
        time: {
          label: 'Time',
          category: { index: { '2022': 0 }, label: { '2022': '2022' } },
        },
      },
      value: [100],
    };

    const results = parseJsonStatResponse(mockJsonStat, 'test_ds');
    assert.equal(results.length, 0);
  });

  it('parseSdmxJsonResponse parses a valid SDMX-JSON response', async () => {
    const { parseSdmxJsonResponse } = await import('../parser.js');

    const mockSdmx = {
      data: {
        structure: {
          dimensions: {
            observation: [
              {
                id: 'TIME_PERIOD',
                name: 'Time',
                values: [
                  { id: '2022', name: '2022' },
                  { id: '2023', name: '2023' },
                ],
              },
              {
                id: 'REF_AREA',
                name: 'Geography',
                values: [
                  { id: 'DE', name: 'Germany' },
                  { id: 'FR', name: 'France' },
                ],
              },
            ],
          },
        },
        dataSets: [
          {
            observations: {
              '0:0': [100],
              '0:1': [90],
              '1:0': [110],
              '1:1': [95],
            },
          },
        ],
      },
    };

    const results = parseSdmxJsonResponse(mockSdmx, 'nama_10_pc');
    assert.equal(results.length, 4);
    assert.equal(results[0].geo, 'DE');
    assert.equal(results[0].year, 2022);
    assert.equal(results[0].value, 100);
    assert.equal(results[0].indicatorCode, 'nama_10_pc');
  });

  it('buildCountryProfile filters indicators for a specific geo', async () => {
    const { buildCountryProfile } = await import('../parser.js');

    const values = [
      { id: 'DE:ds1:2022', geo: 'DE', indicatorCode: 'ds1', year: 2022, value: 100 },
      { id: 'FR:ds1:2022', geo: 'FR', indicatorCode: 'ds1', year: 2022, value: 90 },
      { id: 'DE:ds1:2023', geo: 'DE', indicatorCode: 'ds1', year: 2023, value: 110 },
    ];

    const profile = buildCountryProfile('DE', values);
    assert.equal(profile.geo, 'DE');
    assert.equal(profile.indicators.length, 2);
    assert.ok(profile.lastUpdated);
  });

  it('buildEurostatComparison groups values by geo', async () => {
    const { buildEurostatComparison } = await import('../parser.js');

    const values = [
      { id: 'DE:ds1:2022', geo: 'DE', indicatorCode: 'ds1', year: 2022, value: 100 },
      { id: 'FR:ds1:2022', geo: 'FR', indicatorCode: 'ds1', year: 2022, value: 90 },
      { id: 'DE:ds1:2023', geo: 'DE', indicatorCode: 'ds1', year: 2023, value: 110 },
    ];

    const comparison = buildEurostatComparison('ds1', values);
    assert.equal(comparison.indicatorCode, 'ds1');
    assert.equal(comparison.entries.length, 2);
    assert.ok(comparison.lastUpdated);
  });

  it('analyzeEurostatTrend detects increasing trend', async () => {
    const { analyzeEurostatTrend } = await import('../parser.js');

    const values = [
      { id: 'DE:ds1:2020', geo: 'DE', indicatorCode: 'ds1', year: 2020, value: 100 },
      { id: 'DE:ds1:2021', geo: 'DE', indicatorCode: 'ds1', year: 2021, value: 120 },
      { id: 'DE:ds1:2022', geo: 'DE', indicatorCode: 'ds1', year: 2022, value: 150 },
    ];

    const trend = analyzeEurostatTrend(values);
    assert.equal(trend.trend, 'increasing');
    assert.equal(trend.startYear, 2020);
    assert.equal(trend.endYear, 2022);
    assert.ok(trend.changeRate > 0);
    assert.equal(trend.indicatorCode, 'ds1');
    assert.equal(trend.geo, 'DE');
  });

  it('analyzeEurostatTrend detects decreasing trend', async () => {
    const { analyzeEurostatTrend } = await import('../parser.js');

    const values = [
      { id: 'DE:ds1:2020', geo: 'DE', indicatorCode: 'ds1', year: 2020, value: 150 },
      { id: 'DE:ds1:2021', geo: 'DE', indicatorCode: 'ds1', year: 2021, value: 120 },
    ];

    const trend = analyzeEurostatTrend(values);
    assert.equal(trend.trend, 'decreasing');
    assert.ok(trend.changeRate < 0);
  });

  it('analyzeEurostatTrend returns no_data for < 2 points', async () => {
    const { analyzeEurostatTrend } = await import('../parser.js');

    const values = [
      { id: 'DE:ds1:2022', geo: 'DE', indicatorCode: 'ds1', year: 2022, value: 100 },
    ];

    const trend = analyzeEurostatTrend(values);
    assert.equal(trend.trend, 'no_data');
    assert.equal(trend.changeRate, 0);
  });

  it('analyzeEurostatTrend returns stable for near-zero change', async () => {
    const { analyzeEurostatTrend } = await import('../parser.js');

    const values = [
      { id: 'DE:ds1:2020', geo: 'DE', indicatorCode: 'ds1', year: 2020, value: 1000 },
      { id: 'DE:ds1:2021', geo: 'DE', indicatorCode: 'ds1', year: 2021, value: 1000.05 },
    ];

    const trend = analyzeEurostatTrend(values);
    assert.equal(trend.trend, 'stable');
  });
});
