// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTimeseries, parseMultiTimeseries } from '../parser.js';
import type { OnsTimeseriesData } from '../types.js';

const mockTimeseries: OnsTimeseriesData = {
  description: {
    title: 'Consumer Price Index',
    cdid: 'CPI',
    unit: 'Index',
    frequency: 'monthly',
    seasonally_adjusted: false,
  },
  months: [
    { date: '2024-01', value: '128.9', year: '2024', month: '01' },
    { date: '2024-02', value: '129.3', year: '2024', month: '02' },
  ],
  quarters: [],
  years: [{ date: '2023', value: '126.5', year: '2023' }],
};

describe('parseTimeseries', () => {
  it('parses monthly data', () => {
    const records = parseTimeseries('CPI', mockTimeseries);
    const monthlyRecords = records.filter((r: { period: string }) => r.period.includes('-'));
    assert.equal(monthlyRecords.length, 2);
    assert.equal(monthlyRecords[0].value, 128.9);
  });

  it('parses annual data', () => {
    const records = parseTimeseries('CPI', mockTimeseries);
    const annualRecords = records.filter((r: { period: string }) => !r.period.includes('-'));
    assert.equal(annualRecords.length, 1);
    assert.equal(annualRecords[0].value, 126.5);
  });

  it('sets metadata from description', () => {
    const records = parseTimeseries('CPI', mockTimeseries);
    assert.equal(records[0].series, 'CPI');
    assert.equal(records[0].frequency, 'monthly');
    assert.equal(records[0].unit, 'Index');
  });

  it('handles NaN values gracefully', () => {
    const nanData: OnsTimeseriesData = {
      description: { title: 'Test', cdid: 'TEST' },
      months: [{ date: '2024-01', value: 'N/A', year: '2024', month: '01' }],
    };
    const records = parseTimeseries('TEST', nanData);
    assert.equal(records[0].value, null);
  });
});

describe('parseMultiTimeseries', () => {
  it('combines records from multiple series', () => {
    const results = new Map<string, OnsTimeseriesData>();
    results.set('CPI', mockTimeseries);
    results.set('GDP', {
      description: { title: 'GDP', cdid: 'GDP', frequency: 'quarterly' },
      quarters: [{ date: '2024-Q1', value: '500.2', year: '2024', quarter: '1' }],
    });
    const records = parseMultiTimeseries(results);
    assert.equal(records.length, 4); // 2 months + 1 year (CPI) + 1 quarter (GDP)
  });
});
