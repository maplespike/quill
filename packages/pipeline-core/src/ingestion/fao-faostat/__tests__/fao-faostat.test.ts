// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ingestion/fao-faostat', () => {
  it('constants module loads with correct exports', async () => {
    const constantsMod = await import('../constants.js');
    assert.ok(constantsMod, 'constants should load');
    assert.ok(Object.keys(constantsMod).length > 0, 'constants should export at least one value');
    assert.ok(constantsMod.FAO_API_BASE, 'constants should export FAO_API_BASE');
    assert.ok(constantsMod.FAO_DOMAINS, 'constants should export FAO_DOMAINS');
    assert.ok(constantsMod.KEY_DOMAINS, 'constants should export KEY_DOMAINS');
    assert.ok(constantsMod.COMMON_COUNTRIES, 'constants should export COMMON_COUNTRIES');
  });

  it('types module loads correctly', async () => {
    const typesMod = await import('../types.js');
    assert.ok(typesMod, 'types should load');
  });

  it('parser module loads and exports functions', async () => {
    const parserMod = await import('../parser.js');
    assert.ok(parserMod, 'parser should load');
    const keys = Object.keys(parserMod);
    assert.ok(keys.length > 0, 'parser should export at least one item');
    assert.ok(typeof parserMod.parseFaoResponse === 'function', 'parser should export parseFaoResponse');
  });

  it('fetcher module loads and exports functions', async () => {
    const fetcherMod = await import('../fetcher.js');
    assert.ok(fetcherMod, 'fetcher should load');
    assert.ok(typeof fetcherMod.fetchFaoDataset === 'function', 'fetcher should export fetchFaoDataset');
    assert.ok(typeof fetcherMod.fetchFaoDomainList === 'function', 'fetcher should export fetchFaoDomainList');
  });

  it('index module exports the expected public API', async () => {
    const indexMod = await import('../index.js');
    const keys = Object.keys(indexMod);
    assert.ok(keys.length > 0, 'index should export at least one item');
    assert.ok(typeof indexMod.ingestFaoDataset === 'function', 'index should export ingestFaoDataset');
    assert.ok(typeof indexMod.ingestAllFao === 'function', 'index should export ingestAllFao');
    assert.ok(typeof indexMod.searchFaoRecords === 'function', 'index should export searchFaoRecords');
  });

  describe('parseFaoResponse', () => {
    it('returns empty array for null input', async () => {
      const { parseFaoResponse } = await import('../parser.js');
      const result = parseFaoResponse(null, 'QCL');
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('returns empty array for undefined input', async () => {
      const { parseFaoResponse } = await import('../parser.js');
      const result = parseFaoResponse(undefined, 'QCL');
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('returns empty array for empty object', async () => {
      const { parseFaoResponse } = await import('../parser.js');
      const result = parseFaoResponse({}, 'QCL');
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('parses FAO data array correctly', async () => {
      const { parseFaoResponse } = await import('../parser.js');
      const mockData = {
        data: [
          {
            Area: 'Canada',
            'Area Code': '351',
            Element: 'Production',
            'Element Code': '5510',
            Item: 'Wheat',
            'Item Code': '15',
            Year: '2022',
            Value: '32500',
            Flag: '',
            'Flag Description': '',
          },
        ],
      };
      const result = parseFaoResponse(mockData, 'QCL');
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 1);
      assert.equal(result[0].area, 'Canada');
      assert.equal(result[0].areaCode, '351');
      assert.equal(result[0].item, 'Wheat');
      assert.equal(result[0].year, 2022);
      assert.equal(result[0].value, 32500);
      assert.ok(result[0].id, 'record should have an id');
      assert.ok(result[0].id.length > 0, 'id should not be empty');
    });

    it('handles null/empty values gracefully', async () => {
      const { parseFaoResponse } = await import('../parser.js');
      const mockData = {
        data: [
          {
            Area: 'Canada',
            'Area Code': '351',
            Element: 'Production',
            'Element Code': '5510',
            Item: 'Wheat',
            'Item Code': '15',
            Year: '2022',
            Value: '',
            Flag: null,
            'Flag Description': null,
          },
        ],
      };
      const result = parseFaoResponse(mockData, 'QCL');
      assert.equal(result.length, 1);
      assert.equal(result[0].value, null);
    });

    it('uses domain name from FAO_DOMAINS mapping', async () => {
      const { parseFaoResponse } = await import('../parser.js');
      const mockData = {
        data: [
          { Area: 'Canada', 'Area Code': '351', Element: 'Production', 'Element Code': '5510', Item: 'Wheat', 'Item Code': '15', Year: '2022', Value: '100' },
        ],
      };
      const result = parseFaoResponse(mockData, 'QCL');
      assert.equal(result[0].domain, 'Crops and livestock products');
    });

    it('falls back to domain code for unknown domains', async () => {
      const { parseFaoResponse } = await import('../parser.js');
      const mockData = {
        data: [
          { Area: 'Canada', 'Area Code': '351', Element: 'Production', 'Element Code': '5510', Item: 'Wheat', 'Item Code': '15', Year: '2022', Value: '100' },
        ],
      };
      const result = parseFaoResponse(mockData, 'UNKNOWN');
      assert.equal(result[0].domain, 'UNKNOWN');
    });
  });
});
