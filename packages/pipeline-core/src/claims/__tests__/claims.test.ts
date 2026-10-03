// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Claim Stack unit tests — canonical JSON determinism, bundle building,
 * batch merkle commitment, and local hash verification.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  canonicalJson,
  buildClaimBundle,
  buildClaimBatch,
  verifyClaimHash,
  DEFAULT_CLAIM_LICENSE,
} from '../index.js';
import { citationStore, CitationStore } from '../store.js';
import { registerModuleClaims, registerModuleResultClaims } from '../ingest-hook.js';

describe('claims: canonicalJson', () => {
  it('produces stable output regardless of key insertion order', () => {
    const a = canonicalJson({ b: 1, a: [3, 2, { y: 1, x: 2 }] });
    const b = canonicalJson({ a: [3, 2, { x: 2, y: 1 }], b: 1 });
    assert.equal(a, b);
    assert.equal(a, '{"a":[3,2,{"x":2,"y":1}],"b":1}');
  });

  it('handles nested arrays and primitives', () => {
    assert.equal(canonicalJson([1, 'two', null]), '[1,"two",null]');
    assert.equal(canonicalJson('plain'), '"plain"');
  });
});

describe('claims: buildClaimBundle', () => {
  it('computes a reproducible sha256 over canonical JSON', async () => {
    const value = { title: 'Test', url: 'https://example.ca' };
    const bundle = await buildClaimBundle({
      claim: 'Test record',
      value,
      sourceName: 'Example',
      sourceUrl: 'https://example.ca',
    });

    assert.equal(bundle.sha256.length, 64);
    assert.match(bundle.sha256, /^[a-f0-9]{64}$/);
    assert.equal(bundle.license, DEFAULT_CLAIM_LICENSE);
    assert.equal(bundle.retrievedAt, undefined, 'claim creation time is not source retrieval time');
    assert.deepEqual(bundle.transformations, []);
    assert.equal(bundle.provenanceEvidence.record_integrity.scope, 'canonical-json-record');
    assert.equal(bundle.provenanceEvidence.acquisition.status, 'not-captured');
    assert.equal(bundle.retrievedAt, undefined);
    assert.equal(bundle.provenanceEvidence.publisher_terms.status, 'not-observed');

    // Same value → same hash (determinism)
    const again = await buildClaimBundle({
      claim: 'Test record',
      value: { url: 'https://example.ca', title: 'Test' },
      sourceName: 'Example',
      sourceUrl: 'https://example.ca',
    });
    assert.equal(again.sha256, bundle.sha256);
  });

  it('honors custom license and transformations', async () => {
    const bundle = await buildClaimBundle({
      claim: 'C',
      value: { n: 1 },
      sourceName: 'S',
      sourceUrl: 'https://s.ca',
      license: 'CC0',
      transformations: ['normalize'],
    });
    assert.equal(bundle.license, 'CC0');
    assert.deepEqual(bundle.transformations, ['normalize']);
    assert.equal(bundle.provenanceEvidence.publisher_terms.status, 'not-observed');
    assert.deepEqual(bundle.provenanceEvidence.transformations.steps, ['normalize']);
  });
});

describe('claims: buildClaimBatch', () => {
  it('commits all bundles under a single merkle root', async () => {
    const { bundles, merkleRoot } = await buildClaimBatch([
      { claim: 'one', value: { id: 1 }, sourceName: 'S', sourceUrl: 'https://s.ca' },
      { claim: 'two', value: { id: 2 }, sourceName: 'S', sourceUrl: 'https://s.ca' },
      { claim: 'three', value: { id: 3 }, sourceName: 'S', sourceUrl: 'https://s.ca' },
    ]);
    assert.equal(bundles.length, 3);
    assert.equal(merkleRoot.length, 64);
    for (const b of bundles) {
      assert.equal(b.merkleRoot, merkleRoot);
    }
  });
});

describe('claims: verifyClaimHash', () => {
  it('verifies a matching hash', async () => {
    const value = { a: 1 };
    const bundle = await buildClaimBundle({ claim: 'c', value, sourceName: 's', sourceUrl: 'u' });
    const ok = await verifyClaimHash(value, bundle.sha256);
    assert.equal(ok, true);
  });

  it('rejects a mismatched hash', async () => {
    const ok = await verifyClaimHash({ a: 2 }, 'a'.repeat(64));
    assert.equal(ok, false);
  });

  it('accepts prefixed sha256: form', async () => {
    const value = { a: 1 };
    const bundle = await buildClaimBundle({ claim: 'c', value, sourceName: 's', sourceUrl: 'u' });
    const ok = await verifyClaimHash(value, `sha256:${bundle.sha256}`);
    assert.equal(ok, true);
  });
});

describe('claims: CitationStore', () => {
  it('stores and retrieves bundles, including in-memory fallback', async () => {
    const store = new CitationStore();
    const bundle = await buildClaimBundle({
      claim: 'stored claim',
      value: { k: 'v' },
      sourceName: 'Source',
      sourceUrl: 'https://s.ca',
    });
    store.put(bundle);
    assert.equal(store.has(bundle.sha256), true);
    const got = store.get(bundle.sha256);
    assert.ok(got);
    assert.equal(got.bundle.claim, 'stored claim');
    assert.equal(store.keys().length, 1);
    store.clear();
    assert.equal(store.size, 0);
  });

  it('supports sha256-prefixed lookups and the shared singleton', async () => {
    const bundle = await buildClaimBundle({
      claim: 'singleton',
      value: { x: 1 },
      sourceName: 'S',
      sourceUrl: 'https://s.ca',
    });
    citationStore.put(bundle);
    const got = citationStore.get(`sha256:${bundle.sha256}`);
    assert.ok(got);
    citationStore.clear();
  });
});

describe('claims: ingest hook (WS-1b)', () => {
  it('carries publisher-provided license metadata into a claim bundle', async () => {
    citationStore.clear();
    await registerModuleClaims('license-hook-test', [{
      id: 'dataset-1',
      title: 'Licensed dataset',
      url: 'https://publisher.example/dataset',
      license_title: 'CC BY 4.0',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
    }]);
    const stored = citationStore.get(citationStore.keys()[0]);
    assert.ok(stored);
    assert.equal(stored.bundle.license, 'Publisher-declared: CC BY 4.0');
    assert.equal(stored.bundle.licenseUrl, 'https://creativecommons.org/licenses/by/4.0/');
    assert.equal(stored.bundle.licenseBasis, 'publisher-metadata');
    assert.equal(stored.bundle.provenanceEvidence.publisher_terms.status, 'publisher-metadata-observed');
    assert.equal(stored.bundle.provenanceEvidence.publisher_terms.label, 'CC BY 4.0');
    assert.match(stored.bundle.attributionText ?? '', /publisher's attribution and exclusions/);
    citationStore.clear();
  });

  it('carries configured attribution from attributed result wrappers without promoting it to publisher metadata', async () => {
    citationStore.clear();
    const count = await registerModuleResultClaims('attributed-result-test', {
      data: {
        records: [{ id: 'record-1', title: 'Configured terms example', url: 'https://record.example' }],
      },
      attribution: {
        source: 'Statistics Canada',
        sourceUrl: 'https://www.statcan.gc.ca/',
        license: 'Statistics Canada Open Licence (source configuration; dataset coverage not verified)',
        licenseUrl: 'https://www.statcan.gc.ca/en/terms-conditions/open-licence',
        licenseBasis: 'source-configuration',
        attributionText: 'Verify terms for the specific dataset.',
        retrievedAt: new Date(),
      },
    });
    assert.equal(count, 1);
    const stored = citationStore.get(citationStore.keys()[0]);
    assert.ok(stored);
    assert.equal(stored.bundle.licenseBasis, 'source-configuration');
    assert.equal(stored.bundle.provenanceEvidence.publisher_terms.status, 'source-configuration-only');
    assert.equal(stored.bundle.provenanceEvidence.publisher_terms.label, null);
    assert.equal(stored.bundle.licenseUrl, 'https://www.statcan.gc.ca/en/terms-conditions/open-licence');
    assert.equal(stored.bundle.attributionText, 'Verify terms for the specific dataset.');
    citationStore.clear();
  });

  it('prefers a real per-record url over the module source label', async () => {
    citationStore.clear();
    const count = await registerModuleClaims(
      'ingest-hook-test',
      [{ id: 1, title: 'Record A', url: 'https://record.example/a' }],
      'https://portal.example',
    );
    assert.equal(count, 1);

    const keys = citationStore.keys();
    assert.equal(keys.length, 1);
    const got = citationStore.get(keys[0]);
    assert.ok(got);
    assert.equal(got.bundle.sourceUrl, 'https://record.example/a');
    assert.equal(got.bundle.sourceName, 'ingest-hook-test');
    assert.deepEqual(got.bundle.transformations, ['ingestion']);
    citationStore.clear();
  });

  it('resolves url precedence: record.url -> source_url -> sourceUrl -> label', async () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      // Real per-record url wins over every fallback.
      [{ id: 1, url: 'https://r.example', source_url: 'https://su.example' }, 'https://r.example'],
      // source_url beats sourceUrl and the label.
      [{ id: 1, source_url: 'https://su.example', sourceUrl: 'https://suc.example' }, 'https://su.example'],
      // sourceUrl beats the module-level label.
      [{ id: 1, sourceUrl: 'https://suc.example' }, 'https://suc.example'],
      // No record-level url at all -> module source label.
      [{ id: 1 }, 'https://label.example'],
    ];
    for (const [record, expected] of cases) {
      citationStore.clear();
      await registerModuleClaims('ingest-hook-test', [record], 'https://label.example');
      const keys = citationStore.keys();
      assert.equal(keys.length, 1, `one bundle expected for ${JSON.stringify(record)}`);
      const got = citationStore.get(keys[0]);
      assert.ok(got);
      assert.equal(got.bundle.sourceUrl, expected, `sourceUrl for ${JSON.stringify(record)}`);
    }
    citationStore.clear();
  });

  it('wraps single-record module results but skips status envelopes and count-only results', async () => {
    citationStore.clear();
    const single = await registerModuleResultClaims(
      'ingest-hook-test',
      { id: 'r1', title: 'Single', url: 'https://s.example' },
      'https://label.example',
    );
    assert.equal(single, 1);
    assert.equal(citationStore.size, 1);
    // The wrapped bundle is the record itself, not an envelope.
    const got = citationStore.get(citationStore.keys()[0]);
    assert.ok(got);
    assert.equal(got.bundle.sourceUrl, 'https://s.example');

    citationStore.clear();
    const envelope = await registerModuleResultClaims(
      'ingest-hook-test',
      { skipped: true, url: 'https://s.example' },
      'https://label.example',
    );
    assert.equal(envelope, 0);
    assert.equal(citationStore.size, 0);

    const errorEnvelope = await registerModuleResultClaims(
      'ingest-hook-test',
      { error: 'boom', url: 'https://s.example' },
      'https://label.example',
    );
    assert.equal(errorEnvelope, 0);
    assert.equal(citationStore.size, 0);

    const countOnly = await registerModuleResultClaims('ingest-hook-test', { count: 5 }, '');
    assert.equal(countOnly, 0);
  });

  it('registers dictionary-shaped results (committees style: Record<acronym, Result>)', async () => {
    citationStore.clear();
    const count = await registerModuleResultClaims(
      'ingest-hook-test',
      {
        AGRI: { committee: 'AGRI', meetingsFound: 3, meetingsIngested: 2, errors: [] },
        FINA: { committee: 'FINA', meetingsFound: 1, meetingsIngested: 1, errors: ['meeting #1: nope'] },
      },
      'https://label.example',
    );
    assert.equal(count, 2);
    assert.equal(citationStore.size, 2);
    citationStore.clear();
  });

  it('does not treat a status envelope as a dictionary of records', async () => {
    citationStore.clear();
    const count = await registerModuleResultClaims(
      'ingest-hook-test',
      { skipped: true, url: 'https://s.example' },
      'https://label.example',
    );
    assert.equal(count, 0);
    assert.equal(citationStore.size, 0);
  });
});
