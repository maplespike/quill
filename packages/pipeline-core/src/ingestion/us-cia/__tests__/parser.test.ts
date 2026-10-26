// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCountryProfile, parseMultiCountryProfiles, buildComparison } from '../parser.js';
import type { CiaRawProfile } from '../types.js';

const mockProfile: CiaRawProfile = {
  country_code: 'CA',
  country_name: 'Canada',
  region: 'Americas',
  fields: {
    population: { value: 38929902, rank: 37, comparison_date: '2023' },
    gdp: { value: '$2.14 trillion', rank: 10, comparison_date: '2023' },
    life_expectancy: { value: '82.3 years', rank: 25, comparison_date: '2023' },
  },
  last_updated: '2024-01-01',
};

describe('parseCountryProfile', () => {
  it('parses a valid profile into fact records', () => {
    const records = parseCountryProfile(mockProfile);
    assert.equal(records.length, 3);
    assert.equal(records[0].countryCode, 'CA');
    assert.equal(records[0].field, 'population');
    assert.equal(records[0].value, 38929902);
    assert.equal(records[0].rank, 37);
    assert.equal(records[0].id, 'CIA:CA:population');
  });

  it('skips fields not present in profile', () => {
    const records = parseCountryProfile(mockProfile);
    const fieldNames = records.map((r: { field: string }) => r.field);
    assert.ok(!fieldNames.includes('unemployment_rate'));
  });

  it('returns empty array for empty country code', () => {
    const emptyProfile = { ...mockProfile, country_code: '' };
    const records = parseCountryProfile(emptyProfile as CiaRawProfile);
    assert.deepEqual(records, []);
  });
});

describe('parseMultiCountryProfiles', () => {
  it('combines records from multiple profiles', () => {
    const profiles = new Map<string, CiaRawProfile>();
    profiles.set('CA', mockProfile);
    profiles.set('US', { ...mockProfile, country_code: 'US', country_name: 'United States' });
    const records = parseMultiCountryProfiles(profiles);
    assert.equal(records.length, 6);
  });
});

describe('buildComparison', () => {
  it('builds a comparison from field data', () => {
    const data = [
      { country: 'CA', value: 38929902, rank: 37 },
      { country: 'US', value: 331900000, rank: 3 },
    ];
    const comp = buildComparison('population', 'Population', data);
    assert.equal(comp.field, 'population');
    assert.equal(comp.entries.length, 2);
    assert.equal(comp.entries[0].countryCode, 'CA');
  });
});
