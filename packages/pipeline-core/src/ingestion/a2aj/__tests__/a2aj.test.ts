// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toCoverageItem, toSearchResult, parseCoverageItems, parseSearchResults } from '../parser.js';

describe('a2aj parser', () => {
  describe('toCoverageItem', () => {
    it('should parse a valid coverage item', () => {
      const raw = { dataset: 'cases', description_en: 'Test description', description_fr: 'Description de test', earliest_document_date: '2020-01-01', latest_document_date: '2024-12-31', number_of_documents: 100 };
      const result = toCoverageItem(raw);
      assert.ok(result !== null);
      assert.equal(result?.dataset, 'cases');
      assert.equal(result?.descriptionEn, 'Test description');
      assert.equal(result?.descriptionFr, 'Description de test');
      assert.equal(result?.numberOfDocuments, 100);
    });

    it('should return null for null input', () => {
      assert.equal(toCoverageItem(null), null);
    });

    it('should handle missing fields', () => {
      const raw = { dataset: 'cases' };
      const result = toCoverageItem(raw);
      assert.equal(result?.dataset, 'cases');
      assert.equal(result?.descriptionEn, '');
      assert.equal(result?.earliestDocumentDate, null);
      assert.equal(result?.numberOfDocuments, 0);
    });
  });

  describe('toSearchResult', () => {
    it('should parse a valid search result', () => {
      const raw = { citation: '2023 SCC 1', title: 'Test Case', snippet: 'Test snippet', dataset: 'cases', score: 0.95 };
      const result = toSearchResult(raw);
      assert.ok(result !== null);
      assert.equal(result?.citation, '2023 SCC 1');
      assert.equal(result?.title, 'Test Case');
      assert.equal(result?.score, 0.95);
    });

    it('should use name when title is missing', () => {
      const raw = { citation: '2023 SCC 2', name: 'Named Case', snippet: 'Snippet', dataset: 'laws', score: 0.8 };
      const result = toSearchResult(raw);
      assert.equal(result?.title, 'Named Case');
    });

    it('should use text substring when snippet is missing', () => {
      const raw = { citation: '2023 SCC 3', title: 'Another Case', text: 'Longer text that should be truncated for the snippet field', dataset: 'cases', score: 0.75 };
      const result = toSearchResult(raw);
      assert.equal(result?.snippet, 'Longer text that should be truncated for the snippet field');
    });
  });

  describe('parseCoverageItems', () => {
    it('should parse multiple coverage items', () => {
      const results = [{ dataset: 'cases', description_en: 'Cases', number_of_documents: 50 }, { dataset: 'laws', description_en: 'Laws', number_of_documents: 30 }];
      const parsed = parseCoverageItems(results);
      assert.equal(parsed.length, 2);
      assert.equal(parsed[0].dataset, 'cases');
      assert.equal(parsed[1].dataset, 'laws');
    });

    it('should handle empty array', () => {
      assert.deepEqual(parseCoverageItems([]), []);
    });

    it('should filter out invalid items', () => {
      const results = [{ dataset: 'cases', description_en: 'Valid', number_of_documents: 10 }, null, undefined, { dataset: 'laws', description_en: 'Also Valid', number_of_documents: 20 }];
      const parsed = parseCoverageItems(results);
      assert.equal(parsed.length, 2);
    });
  });

  describe('parseSearchResults', () => {
    it('should parse multiple search results', () => {
      const results = [{ citation: 'C1', title: 'Case 1', snippet: 'S1', dataset: 'cases', score: 0.9 }, { citation: 'C2', title: 'Case 2', snippet: 'S2', dataset: 'laws', score: 0.8 }];
      const parsed = parseSearchResults(results);
      assert.equal(parsed.length, 2);
    });

    it('should handle empty array', () => {
      assert.deepEqual(parseSearchResults([]), []);
    });

    it('should filter out invalid results', () => {
      const results = [{ citation: 'C1', title: 'Case 1', snippet: 'S1', dataset: 'cases', score: 0.9 }, null, { citation: 'C2', title: 'Case 2', snippet: 'S2', dataset: 'laws', score: 0.8 }];
      const parsed = parseSearchResults(results);
      assert.equal(parsed.length, 2);
    });
  });
});
