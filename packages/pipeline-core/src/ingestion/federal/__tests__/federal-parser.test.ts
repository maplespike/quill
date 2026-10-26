// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toFederalDatasetFromCkan, toFederalDatasetFromCihi, parseCkanSearchResults } from '../parser.js';

describe('federal parser', () => {
  describe('toFederalDatasetFromCihi', () => {
    it('should create a CIHI dataset', async () => {
      const result = await toFederalDatasetFromCihi('wait-times.csv');

      assert.equal(result.agency, 'CIHI');
      assert.equal(result.dataset, 'wait-times.csv');
      assert.equal(result.format, 'XLSX');
      assert.ok(result.year > 2020);
      assert.ok(result.title.includes('CIHI Wait Times'));
      assert.ok(result.url.includes('wait-times.csv'));
    });
  });

  describe('toFederalDatasetFromCkan', () => {
    it('should create a CKAN dataset', async () => {
      const pkg = {
        id: 'test-dataset-123',
        title: 'Test Dataset',
        name: 'test-dataset',
        notes: 'This is a test dataset',
        metadata_created: '2023-01-15T10:30:00',
      };

      const result = await toFederalDatasetFromCkan('ESDC', pkg);

      assert.notEqual(result, null);
      assert.equal(result?.agency, 'ESDC');
      assert.equal(result?.dataset, 'Test Dataset');
      assert.equal(result?.year, 2023);
      assert.equal(result?.format, 'CKAN');
      assert.ok(result?.url?.includes('test-dataset-123'));
      assert.equal(result?.description, 'This is a test dataset');
    });

    it('should return null for null package', async () => {
      const result = await toFederalDatasetFromCkan('ESDC', null);
      assert.equal(result, null);
    });

    it('should handle missing year from metadata', async () => {
      const pkg = {
        id: 'test-dataset-456',
        title: 'Test Dataset No Year',
        notes: 'No year',
      };

      const result = await toFederalDatasetFromCkan('ESDC', pkg);
      assert.equal(result?.year, new Date().getFullYear());
    });
  });

  describe('parseCkanSearchResults', () => {
    it('should parse CKAN search results', async () => {
      const results = [
        { id: 'pkg1', title: 'Package 1', notes: 'Notes 1', metadata_created: '2023-01-01' },
        { id: 'pkg2', title: 'Package 2', notes: 'Notes 2', metadata_created: '2023-06-01' },
      ];

      const parsed = await parseCkanSearchResults('PHAC', results, 10, 0);
      assert.equal(parsed.length, 2);
      assert.equal(parsed[0].agency, 'PHAC');
      assert.equal(parsed[1].agency, 'PHAC');
    });

    it('should respect maxRecords limit', async () => {
      const results = [
        { id: 'pkg1', title: 'Package 1', notes: 'Notes 1', metadata_created: '2023-01-01' },
        { id: 'pkg2', title: 'Package 2', notes: 'Notes 2', metadata_created: '2023-06-01' },
        { id: 'pkg3', title: 'Package 3', notes: 'Notes 3', metadata_created: '2023-12-01' },
      ];

      const parsed = await parseCkanSearchResults('PHAC', results, 2, 0);
      assert.equal(parsed.length, 2);
    });

    it('should handle current count when enforcing maxRecords', async () => {
      const results = [
        { id: 'pkg1', title: 'Package 1', notes: 'Notes 1', metadata_created: '2023-01-01' },
        { id: 'pkg2', title: 'Package 2', notes: 'Notes 2', metadata_created: '2023-06-01' },
      ];

      // maxRecords=2 with currentCount=1 means only 1 more fits (1 + 1 >= 2 breaks).
      const parsed = await parseCkanSearchResults('PHAC', results, 2, 1);
      assert.equal(parsed.length, 1);
    });

    it('should handle empty array', async () => {
      const parsed = await parseCkanSearchResults('PHAC', [], 10, 0);
      assert.deepEqual(parsed, []);
    });

    it('should filter out invalid packages', async () => {
      const results = [
        { id: 'pkg1', title: 'Valid Package', notes: 'Valid', metadata_created: '2023-01-01' },
        null,
        undefined,
        { id: 'pkg2', title: 'Another Valid', notes: 'Also Valid', metadata_created: '2023-06-01' },
      ];

      const parsed = await parseCkanSearchResults('PHAC', results, 10, 0);
      assert.equal(parsed.length, 2);
    });
  });
});
