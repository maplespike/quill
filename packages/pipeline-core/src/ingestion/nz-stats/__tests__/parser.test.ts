// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseODataRecords } from '../parser.js';
import type { SnzODataRecord } from '../types.js';

const mockRecords: SnzODataRecord[] = [
  { Period: '2024.01', Value: 115.3, Series_reference: 'CPI', Subject: 'Consumer Price Index' },
  { Period: '2024.02', Value: 116.1, Series_reference: 'CPI', Subject: 'Consumer Price Index' },
];

describe('parseODataRecords', () => {
  it('parses OData records into fact records', () => {
    const records = parseODataRecords('CPI', 'Consumer Price Index', mockRecords);
    assert.equal(records.length, 2);
    assert.equal(records[0].dataset, 'CPI');
    assert.equal(records[0].value, 115.3);
  });

  it('extracts period from time-like columns', () => {
    const records = parseODataRecords('CPI', 'CPI', mockRecords);
    assert.equal(records[0].period, '2024.01');
  });

  it('puts non-value, non-time columns into dimensions', () => {
    const records = parseODataRecords('CPI', 'CPI', mockRecords);
    assert.equal(records[0].dimensions['Series_reference'], 'CPI');
  });

  it('handles empty records gracefully', () => {
    const records = parseODataRecords('CPI', 'CPI', []);
    assert.deepEqual(records, []);
  });
});
