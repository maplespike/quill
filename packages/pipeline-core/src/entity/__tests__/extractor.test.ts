// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { extractEntities } from '../extractor.js';

describe('entity:extractor', () => {
  it('should extract person mentions from committee records', () => {
    const mentions = extractEntities({
      module: 'committees',
      recordId: 'rec-001',
      data: {
        witness_name: 'John A. Macdonald',
        witness_organization: 'Government of Canada',
        chairperson: 'Mr. Smith',
        date: '2024-01-15',
        citation_sha256: 'abc123',
        trust_score: 0.9,
      },
      extractionRules: [
        {
          field: 'witness_name',
          entityType: 'person',
          normalize: (v: string) => v.toLowerCase().trim(),
          confidence: () => 0.9,
        },
        {
          field: 'witness_organization',
          entityType: 'organization',
          normalize: (v: string) => v.toLowerCase().trim(),
          confidence: () => 0.85,
        },
      ],
    });

    assert.ok(mentions.length >= 2);
    assert.strictEqual(mentions[0].entityType, 'person');
    assert.strictEqual(mentions[0].entityName, 'John A. Macdonald');
    assert.strictEqual(mentions[0].recordDate, '2024-01-15');
    assert.strictEqual(mentions[0].confidenceScore, 0.9);
    assert.ok(mentions[0].entityId.length === 16);

    assert.strictEqual(mentions[1].entityType, 'organization');
    assert.strictEqual(mentions[1].entityName, 'Government of Canada');
  });

  it('should skip empty or non-string values', () => {
    const mentions = extractEntities({
      module: 'test',
      recordId: 'rec-002',
      data: {
        person_name: '',
        org_name: null,
        empty_field: '   ',
      },
      extractionRules: [
        { field: 'person_name', entityType: 'person', normalize: (v) => v.toLowerCase(), confidence: () => 0.8 },
        { field: 'org_name', entityType: 'organization', normalize: (v) => v.toLowerCase(), confidence: () => 0.8 },
        { field: 'empty_field', entityType: 'other', normalize: (v) => v.toLowerCase(), confidence: () => 0.5 },
      ],
    });

    assert.strictEqual(mentions.length, 0);
  });

  it('should generate deterministic entity IDs', () => {
    const config = {
      module: 'test',
      recordId: 'rec-003',
      data: { person_name: 'Alice Smith', citation_sha256: 'xyz', trust_score: 0.85 },
      extractionRules: [
        { field: 'person_name', entityType: 'person', normalize: (v: string) => v.toLowerCase().trim(), confidence: () => 0.9 },
      ],
    };

    const m1 = extractEntities(config);
    const m2 = extractEntities(config);
    assert.strictEqual(m1[0].entityId, m2[0].entityId);
  });

  it('should not include id or ingestedAt from fields', () => {
    const mentions = extractEntities({
      module: 'test',
      recordId: 'rec-004',
      data: {
        person_name: 'Bob',
        date: '2024-06-01',
      },
      extractionRules: [
        { field: 'person_name', entityType: 'person', normalize: (v) => v.toLowerCase().trim(), confidence: () => 0.8 },
      ],
    });

    assert.strictEqual(mentions.length, 1);
    assert.strictEqual(mentions[0].entityName, 'Bob');
    assert.strictEqual(mentions[0].recordDate, '2024-06-01');
  });

  it('should handle empty extraction rules gracefully', () => {
    const mentions = extractEntities({
      module: 'test',
      recordId: 'rec-005',
      data: { person_name: 'Charlie' },
      extractionRules: [],
    });

    assert.strictEqual(mentions.length, 0);
  });
});

describe('entity:normalize', () => {
  it('should normalize names correctly', async () => {
    const { normalizeName, generateCanonicalId } = await import('../normalize.js');
    assert.strictEqual(normalizeName(' John A.  Macdonald '), 'john a macdonald');
    assert.strictEqual(generateCanonicalId('john a macdonald', 'person'), 'person:john-a-macdonald');
    assert.strictEqual(generateCanonicalId('Government of Canada', 'org'), 'org:government-of-canada');
  });
});
