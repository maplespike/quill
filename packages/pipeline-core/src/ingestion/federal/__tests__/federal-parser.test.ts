// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'node:test';
import { toFederalDatasetFromCkan, toFederalDatasetFromCihi, parseCkanSearchResults } from './parser.js';
import type { FederalDataset } from './types.js';

describe('federal parser', () => {
  describe('toFederalDatasetFromCihi', () => {
    it('should create a CIHI dataset', async () => {
      const result = await toFederalDatasetFromCihi('wait-times.csv');
      
      expect(result.agency).toBe('CIHI');
      expect(result.dataset).toBe('wait-times.csv');
      expect(result.format).toBe('XLSX');
      expect(result.year).toBeGreaterThan(2020);
      expect(result.title).toContain('CIHI Wait Times');
      expect(result.url).toContain('wait-times.csv');
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
      
      expect(result).not.toBeNull();
      expect(result?.agency).toBe('ESDC');
      expect(result?.dataset).toBe('Test Dataset');
      expect(result?.year).toBe(2023);
      expect(result?.format).toBe('CKAN');
      expect(result?.url).toContain('test-dataset-123');
      expect(result?.description).toBe('This is a test dataset');
    });

    it('should return null for null package', async () => {
      const result = await toFederalDatasetFromCkan('ESDC', null);
      expect(result).toBeNull();
    });

    it('should handle missing year from metadata', async () => {
      const pkg = {
        id: 'test-dataset-456',
        title: 'Test Dataset No Year',
        notes: 'No year',
      };

      const result = await toFederalDatasetFromCkan('ESDC', pkg);
      expect(result?.year).toBe(new Date().getFullYear());
    });
  });

  describe('parseCkanSearchResults', () => {
    it('should parse CKAN search results', async () => {
      const results = [
        { id: 'pkg1', title: 'Package 1', notes: 'Notes 1', metadata_created: '2023-01-01' },
        { id: 'pkg2', title: 'Package 2', notes: 'Notes 2', metadata_created: '2023-06-01' },
      ];

      const parsed = await parseCkanSearchResults('PHAC', results, 10, 0);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].agency).toBe('PHAC');
      expect(parsed[1].agency).toBe('PHAC');
    });

    it('should respect maxRecords limit', async () => {
      const results = [
        { id: 'pkg1', title: 'Package 1', notes: 'Notes 1', metadata_created: '2023-01-01' },
        { id: 'pkg2', title: 'Package 2', notes: 'Notes 2', metadata_created: '2023-06-01' },
        { id: 'pkg3', title: 'Package 3', notes: 'Notes 3', metadata_created: '2023-12-01' },
      ];

      const parsed = await parseCkanSearchResults('PHAC', results, 2, 0);
      expect(parsed).toHaveLength(2);
    });

    it('should handle current count when enforcing maxRecords', async () => {
      const results = [
        { id: 'pkg1', title: 'Package 1', notes: 'Notes 1', metadata_created: '2023-01-01' },
        { id: 'pkg2', title: 'Package 2', notes: 'Notes 2', metadata_created: '2023-06-01' },
      ];

      const parsed = await parseCkanSearchResults('PHAC', results, 5, 1);
      expect(parsed).toHaveLength(1);
    });

    it('should handle empty array', async () => {
      const parsed = await parseCkanSearchResults('PHAC', [], 10, 0);
      expect(parsed).toEqual([]);
    });

    it('should filter out invalid packages', async () => {
      const results = [
        { id: 'pkg1', title: 'Valid Package', notes: 'Valid', metadata_created: '2023-01-01' },
        null,
        undefined,
        { id: 'pkg2', title: 'Another Valid', notes: 'Also Valid', metadata_created: '2023-06-01' },
      ];

      const parsed = await parseCkanSearchResults('PHAC', results, 10, 0);
      expect(parsed).toHaveLength(2);
    });
  });
});