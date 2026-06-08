// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Data Quality Scoring — Tests
 *
 * Covers freshness, completeness, provenance, and composite scoring.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  scoreDataQuality,
  scoreFreshness,
  scoreFreshnessBatch,
  recordIngestion,
  getLastIngested,
  hasIngestion,
  clearIngestionStore,
  seedIngestionRecords,
  computeAgeSeconds,
  parseCadence,
  scoreCompleteness,
  scoreRecordCompleteness,
  analyzeRecord,
  analyzeBatchCompleteness,
  isFieldPresent,
  inferExpectedFields,
  scoreProvenance,
  scoreSourceProvenance,
  computeSourceTrust,
  analyzeCitation,
  scoreCitationChain,
  formatQualitySummary,
  scoreToDbRecord,
  scoreToLevel,
} from '../index.ts';

/* ================================================================== */
/*  Types & Helpers                                                    */
/* ================================================================== */

describe('scoreToLevel', () => {
  it('classifies scores correctly', () => {
    assert.equal(scoreToLevel(1.0), 'excellent');
    assert.equal(scoreToLevel(0.95), 'excellent');
    assert.equal(scoreToLevel(0.94), 'good');
    assert.equal(scoreToLevel(0.80), 'good');
    assert.equal(scoreToLevel(0.79), 'fair');
    assert.equal(scoreToLevel(0.60), 'fair');
    assert.equal(scoreToLevel(0.59), 'poor');
    assert.equal(scoreToLevel(0.30), 'poor');
    assert.equal(scoreToLevel(0.29), 'unknown');
    assert.equal(scoreToLevel(0), 'unknown');
  });
});

/* ================================================================== */
/*  Freshness                                                          */
/* ================================================================== */

describe('freshness scoring', () => {
  before(() => clearIngestionStore());
  after(() => clearIngestionStore());

  it('returns unknown score for never-ingested source', () => {
    const result = scoreFreshness('unknown-source');
    assert.equal(result.ageSeconds, Infinity);
    assert.equal(result.score, 0);
    assert.equal(result.level, 'unknown');
  });

  it('returns perfect score for just-ingested source (daily cadence)', () => {
    recordIngestion('my-source', Date.now() - 60_000); // 1 minute ago
    const result = scoreFreshness('my-source', 'daily');
    assert(result.score > 0.99);
    assert.equal(result.level, 'excellent');
    assert.ok(result.ageSeconds <= 60);
  });

  it('scores decaying freshness (monthly cadence)', () => {
    recordIngestion('monthly-source', Date.now() - 15 * 86_400 * 1000); // 15 days ago
    const result = scoreFreshness('monthly-source', 'monthly');
    // 15 days / 30 days stale threshold = 0.5 ratio → score = 1.0 - 0.5*0.5 = 0.75
    assert.equal(result.score, 0.75);
    assert.equal(result.level, 'fair');
  });

  it('scores stale source below 0.5', () => {
    recordIngestion('stale-source', Date.now() - 48 * 3600 * 1000); // 48 hours ago (daily cadence)
    const result = scoreFreshness('stale-source', 'daily');
    // 48h / 24h stale threshold = 2.0 ratio → score = 1.0 - 2.0*0.5 = 0
    assert.equal(result.score, 0);
    assert.equal(result.level, 'unknown');
  });

  it('handles realtime cadence with tight threshold', () => {
    recordIngestion('realtime-source', Date.now() - 120_000); // 2 minutes ago
    const result = scoreFreshness('realtime-source', 'realtime');
    // 120s / 300s stale = 0.4 ratio → score = 1.0 - 0.4*0.5 = 0.8
    assert.equal(result.score, 0.80);
    assert.equal(result.level, 'good');
  });

  it('parses cadence strings correctly', () => {
    assert.equal(parseCadence('daily'), 'daily');
    assert.equal(parseCadence('MONTHLY'), 'monthly');
    assert.equal(parseCadence('event-driven'), 'event-driven');
    assert.equal(parseCadence('unknown-format'), 'unknown');
  });

  it('batch scores multiple sources', () => {
    clearIngestionStore();
    seedIngestionRecords([
      { source: 'src-a', ageSeconds: 60 },
      { source: 'src-b', ageSeconds: 86_400 }, // 24h
    ]);

    const results = scoreFreshnessBatch([
      { source: 'src-a', cadence: 'daily' },
      { source: 'src-b', cadence: 'monthly' },
    ]);

    assert.equal(results.length, 2);
    assert(results[0].score > results[1].score); // newer = better
  });

  it('seed and clear work correctly', () => {
    clearIngestionStore();
    assert.equal(hasIngestion('test'), false);

    seedIngestionRecords([{ source: 'test', ageSeconds: 100 }]);
    assert.equal(hasIngestion('test'), true);

    clearIngestionStore();
    assert.equal(hasIngestion('test'), false);
  });

  it('computeAgeSeconds returns Infinity for unknown', () => {
    assert.equal(computeAgeSeconds('nonexistent'), Infinity);
  });

  it('handles event-driven cadence as non-stale', () => {
    clearIngestionStore();
    seedIngestionRecords([{ source: 'law-library', ageSeconds: 60 * 86_400 }]); // 60 days old
    const result = scoreFreshness('law-library', 'event-driven');
    // event-driven has Infinity threshold — scores based on absolute age
    // 60d / 365d = 0.164 → score = max(0, 1 - 0.164) = 0.836
    assert.equal(result.score, 0.836);
    assert.equal(result.level, 'good');
  });
});

/* ================================================================== */
/*  Completeness                                                       */
/* ================================================================== */

describe('completeness scoring', () => {
  it('isFieldPresent works correctly', () => {
    assert.equal(isFieldPresent('hello'), true);
    assert.equal(isFieldPresent(0), true); // 0 is a valid value
    assert.equal(isFieldPresent(''), false);
    assert.equal(isFieldPresent(null), false);
    assert.equal(isFieldPresent(undefined), false);
    assert.equal(isFieldPresent([]), false);
    assert.equal(isFieldPresent([1]), true);
    assert.equal(isFieldPresent(NaN), false);
  });

  it('analyzeRecord with expected fields', () => {
    const record = { name: 'Alice', age: 30, email: null, phone: undefined };
    const analysis = analyzeRecord(record, ['name', 'age', 'email', 'phone', 'address']);

    assert.equal(analysis.totalFields, 5);
    assert.equal(analysis.presentFields, 2);
    assert.deepEqual(analysis.missingFields, ['email', 'phone', 'address']);
  });

  it('analyzeRecord infers fields from record keys if none provided', () => {
    const record = { id: '1', title: 'Test', value: null };
    const analysis = analyzeRecord(record);

    assert.equal(analysis.totalFields, 3);
    assert.equal(analysis.presentFields, 2);
    assert.deepEqual(analysis.missingFields, ['value']);
  });

  it('analyzeBatchCompleteness across multiple records', () => {
    const records = [
      { name: 'A', age: 30, email: 'a@test.com' },
      { name: 'B', age: null, email: 'b@test.com' },
      { name: 'C', age: 25, email: null },
    ];

    const batch = analyzeBatchCompleteness(records, ['name', 'age', 'email']);

    assert.equal(batch.recordCount, 3);
    assert.equal(batch.totalFields, 3);
    assert.equal(batch.presentFields, 1); // only "name" has ≥80% presence (3/3)
    assert.equal(batch.missingFields.length, 2); // age (2/3) and email (2/3) both below 80%
  });

  it('scoreCompleteness with full data returns excellent', () => {
    const records = [
      { name: 'A', age: 30, email: 'a@test.com', role: 'admin' },
      { name: 'B', age: 25, email: 'b@test.com', role: 'user' },
    ];

    const result = scoreCompleteness(records, 'test-module', ['name', 'age', 'email', 'role']);
    assert(result.score > 0.95);
    assert.equal(result.level, 'excellent');
    assert.equal(result.presentFields, 4);
    assert.equal(result.totalFields, 4);
  });

  it('scoreCompleteness with empty data returns zero', () => {
    const result = scoreCompleteness([], 'empty-module');
    assert.equal(result.score, 0);
    assert.equal(result.level, 'unknown');
  });

  it('scoreCompleteness with partial data rates fairly', () => {
    const records = [
      { name: 'A' },
      { name: 'B', extra: 'val' },
      { name: 'C' },
    ];

    const result = scoreCompleteness(records, 'partial', ['name', 'email', 'phone']);
    // name: 3/3 (100%) — present
    // email: 0/3 (0%) — missing
    // phone: 0/3 (0%) — missing
    // fieldPresenceRate = 1/3 = 0.333
    // per-record density: each has 1/3 fields → avg density = 0.333
    // score = 0.333*0.6 + 0.333*0.4 = 0.333
    assert.equal(result.score, 0.333);
    assert.equal(result.level, 'poor');
  });

  it('inferExpectedFields returns known module fields', () => {
    const fields = inferExpectedFields('committees');
    assert.ok(fields.includes('committee_name'));
    assert.ok(fields.includes('party'));
  });

  it('inferExpectedFields falls back for unknown modules', () => {
    const fields = inferExpectedFields('completely-unknown-module');
    assert.deepEqual(fields, ['id', 'name', 'source', 'rawData', 'createdAt']);
  });

  it('scoreRecordCompleteness works for single record', () => {
    const record = { name: 'Alice', email: 'a@test.com' };
    const result = scoreRecordCompleteness(record, 'inline', ['name', 'email', 'phone']);
    assert.equal(result.presentFields, 2);
    assert.equal(result.totalFields, 3);
  });
});

/* ================================================================== */
/*  Provenance                                                         */
/* ================================================================== */

describe('provenance scoring', () => {
  it('computeSourceTrust returns high scores for known gov domains', () => {
    assert.ok(computeSourceTrust('canada.ca') >= 95);
    assert.ok(computeSourceTrust('https://www.statcan.gc.ca/data') >= 95);
    assert.ok(computeSourceTrust('ontario.ca') >= 90);
  });

  it('computeSourceTrust returns default for unknown sources', () => {
    assert.equal(computeSourceTrust('random-blog.example.com'), 50);
  });

  it('computeSourceTrust returns low scores for adversarial sources', () => {
    assert.ok(computeSourceTrust('rt.com') <= 10);
    assert.ok(computeSourceTrust('sputniknews.com') <= 10);
  });

  it('analyzeCitation with full citation', () => {
    const citation = {
      sourceName: 'statcan',
      sourceUrl: 'https://www.statcan.gc.ca/data',
      dataHash: 'abc123',
      retrievedAt: '2026-06-08T00:00:00Z',
      merkleRoot: 'def456',
      signature: 'ghi789',
      license: 'OGL-C',
    };
    const info = analyzeCitation(citation);
    assert.equal(info.present, true);
    assert.equal(info.hasSourceName, true);
    assert.equal(info.hasSourceUrl, true);
    assert.equal(info.hasDataHash, true);
    assert.equal(info.hasRetrievedAt, true);
    assert.equal(info.hasMerkleRoot, true);
    assert.equal(info.hasSignature, true);
    assert.equal(info.hasLicense, true);
  });

  it('scoreCitationChain with full citation returns 1.0', () => {
    const citation = {
      sourceName: 'statcan',
      sourceUrl: 'https://statcan.gc.ca',
      dataHash: 'abc',
      retrievedAt: '2026-06-08T00:00:00Z',
      license: 'OGL-C',
      merkleRoot: 'def',
      signature: 'ghi',
    };
    // 0.15*4 + 0.10*3 = 0.90
    assert.equal(scoreCitationChain(citation), 0.90);
  });

  it('scoreCitationChain with empty returns 0', () => {
    assert.equal(scoreCitationChain(null), 0);
    assert.equal(scoreCitationChain({}), 0);
  });

  it('scoreProvenance with trusted gov source and full attestation', () => {
    const result = scoreProvenance({
      source: 'statcan.gc.ca',
      citation: {
        sourceName: 'statcan',
        sourceUrl: 'https://statcan.gc.ca',
        dataHash: 'abc123',
        retrievedAt: '2026-06-08T00:00:00Z',
        license: 'OGL-C',
      },
      hashChainVerified: true,
      signatureVerified: true,
      hasAttestation: true,
    });

    assert(result.score > 0.85);
    assert.equal(result.level, 'good');
    assert.equal(result.sourceTrustScore, 97);
    assert.equal(result.citationVerified, true);
    assert.equal(result.hashChainVerified, true);
    assert.equal(result.signatureVerified, true);
  });

  it('scoreProvenance with unknown source and no citations', () => {
    const result = scoreProvenance({
      source: 'random-blog.example.com',
    });

    assert(result.score < 0.50);
    assert.equal(result.citationVerified, false);
    assert.equal(result.hashChainVerified, false);
  });

  it('scoreSourceProvenance creates quick score from source name only', () => {
    const result = scoreSourceProvenance('canada.ca');
    // 98/100 * 0.40 = 0.392 (just the source trust weight)
    assert.ok(result.score > 0.35 && result.score < 0.45);
    assert.equal(result.sourceTrustScore, 98);
  });
});

/* ================================================================== */
/*  Composite Scoring                                                  */
/* ================================================================== */

describe('composite data quality scoring', () => {
  before(() => clearIngestionStore());

  it('returns complete score with all three axes', () => {
    recordIngestion('composite-test', Date.now() - 300_000); // 5 min ago

    const records = [
      { name: 'Company A', sector: 'Tech', revenue: 1_000_000 },
      { name: 'Company B', sector: 'Finance', revenue: 500_000 },
    ];

    const result = scoreDataQuality({
      source: 'composite-test',
      records,
      cadence: 'daily',
      expectedFields: ['name', 'sector', 'revenue'],
      provenance: {
        source: 'statcan.gc.ca',
        citation: {
          sourceName: 'statcan',
          sourceUrl: 'https://statcan.gc.ca',
          dataHash: 'abc',
          retrievedAt: '2026-06-08T00:00:00Z',
        },
        hashChainVerified: true,
      },
    });

    // Should have all three axes populated
    assert.ok(result.freshness.score > 0);
    assert.ok(result.completeness.score > 0);
    assert.ok(result.provenance.score > 0);
    assert.ok(result.composite > 0);

    // Types check
    assert.equal(typeof result.composite, 'number');
    assert.ok(result.composite <= 1.0);
    assert.ok(result.freshness.ageSeconds >= 0);
    assert.equal(result.completeness.recordCount, 2);
    assert.equal(typeof result.scoredAt, 'string');
  });

  it('handles default provenance for unknown sources', () => {
    clearIngestionStore();
    recordIngestion('test-unknown', Date.now() - 60_000);

    const result = scoreDataQuality({
      source: 'test-unknown',
      records: [{ name: 'Record' }],
    });

    assert.ok(result.composite > 0);
    assert.equal(result.provenance.sourceTrustScore, 50);
  });

  it('returns unknown for empty records and no freshness', () => {
    const result = scoreDataQuality({
      source: 'empty-test',
      records: [],
    });

    assert.equal(result.freshness.score, 0);
    assert.equal(result.freshness.level, 'unknown');
    assert.equal(result.completeness.score, 0);
    assert.equal(result.completeness.level, 'unknown');
  });

  it('scoreToDbRecord converts correctly', () => {
    clearIngestionStore();
    recordIngestion('db-test', Date.now());
    const score = scoreDataQuality({
      source: 'db-test',
      records: [{ field: 'value' }],
      cadence: 'daily',
    });

    const record = scoreToDbRecord(score, 'test-id-123');
    assert.equal(record.id, 'test-id-123');
    assert.equal(record.source, 'db-test');
    assert.equal(record.compositeScore, score.composite);
    assert.equal(record.details, JSON.stringify(score));
    assert.ok(record.createdAt);
  });

  it('formatQualitySummary produces readable output', () => {
    clearIngestionStore();
    recordIngestion('summary-test', Date.now() - 3600_000); // 1h ago
    const score = scoreDataQuality({
      source: 'summary-test',
      records: [{ a: 1, b: 2 }],
      cadence: 'daily',
    });

    const summary = formatQualitySummary(score);
    assert.ok(summary.includes('summary-test'));
    assert.ok(summary.includes('Data Quality'));
    assert.ok(summary.includes('Freshness'));
    assert.ok(summary.includes('Completeness'));
    assert.ok(summary.includes('Provenance'));
  });
});

/* ================================================================== */
/*  Edge Cases                                                         */
/* ================================================================== */

describe('edge cases', () => {
  before(() => clearIngestionStore());

  it('freshness with explicit lastIngestedAt timestamp', () => {
    const ts = Date.now() - 600_000; // 10 minutes ago
    const result = scoreFreshness('explicit', 'daily', ts);
    assert.ok(result.score > 0.9);
    assert.equal(result.lastIngestedAt, new Date(ts).toISOString());
  });

  it('completeness with NaN values treated as missing', () => {
    const analysis = analyzeRecord({ value: NaN, name: 'Test' }, ['value', 'name']);
    assert.equal(analysis.missingFields.length, 1);
    assert.equal(analysis.missingFields[0], 'value');
  });

  it('completeness with empty strings treated as missing', () => {
    const analysis = analyzeRecord({ name: '', email: 'test@test.com' }, ['name', 'email']);
    assert.equal(analysis.missingFields.length, 1);
    assert.equal(analysis.missingFields[0], 'name');
  });

  it('provenance with partial citation gets partial score', () => {
    const citation = { sourceName: 'test', sourceUrl: 'https://example.com' };
    const score = scoreCitationChain(citation);
    // sourceName (0.15) + sourceUrl (0.15) = 0.30
    assert.equal(score, 0.30);
  });

  it('batch freshness with no sources returns empty array', () => {
    const results = scoreFreshnessBatch([]);
    assert.deepEqual(results, []);
  });
});
