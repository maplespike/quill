// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSdmxObservations } from '../parser.js';
import type { AbsSdmxJsonData } from '../types.js';

const mockSdmxData: AbsSdmxJsonData = {
  structure: {
    dimensions: {
      observation: [
        { id: 'FREQ', name: 'Frequency', values: [{ id: 'Q', name: 'Quarterly' }] },
        { id: 'REGION', name: 'Region', values: [{ id: 'AUS', name: 'Australia' }] },
        { id: 'TIME_PERIOD', name: 'Time Period', values: [{ id: '2024-Q1', name: '2024-Q1' }, { id: '2024-Q2', name: '2024-Q2' }] },
      ],
    },
  },
  dataSets: [{
    observations: {
      '0:0:0': [155.2],
      '0:0:1': [157.8],
    },
  }],
};

describe('parseSdmxObservations', () => {
  it('parses SDMX-JSON observations into fact records', () => {
    const records = parseSdmxObservations('ABS_CPI', 'Consumer Price Index', mockSdmxData);
    assert.equal(records.length, 2);
    assert.equal(records[0].dataflow, 'ABS_CPI');
    assert.equal(records[0].value, 155.2);
  });

  it('extracts dimension values correctly', () => {
    const records = parseSdmxObservations('ABS_CPI', 'Consumer Price Index', mockSdmxData);
    assert.equal(records[0].dimensions['FREQ'], 'Quarterly');
    assert.equal(records[0].dimensions['REGION'], 'Australia');
  });

  it('handles empty data gracefully', () => {
    const emptyData: AbsSdmxJsonData = {
      structure: { dimensions: { observation: [] } },
      dataSets: [],
    };
    const records = parseSdmxObservations('ABS_CPI', 'CPI', emptyData);
    assert.deepEqual(records, []);
  });
});
