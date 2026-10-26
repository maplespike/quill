// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ── Hermetic DB isolation ────────────────────────────────────────────
// Shares the citation_records table with claims.test.ts otherwise (both
// files run concurrently under `tsx --test`). See claims.test.ts for the
// full note; same throwaway temp DB pattern.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quill-provenance-'));
process.env.QUILL_DB_PATH = path.join(tmpDir, 'quill.db');

after(() => {
  delete process.env.QUILL_DB_PATH;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
import { createHash } from 'node:crypto';
import { buildClaimBundle, canonicalJson } from '../index.js';
import { registerModuleClaims } from '../ingest-hook.js';
import { citationStore, CitationStore } from '../store.js';
import { withIngestionArtifactCapture, recordIngestionArtifact } from '../artifact-capture.js';

const artifactHash = createHash('sha256').update('{"rows":[]}', 'utf8').digest('hex');

describe('claim provenance evidence', () => {
  it('keeps captured response evidence distinct from the canonical record hash', async () => {
    const bundle = await buildClaimBundle({
      claim: 'Record one',
      value: { id: 1 },
      sourceName: 'Example source',
      sourceUrl: 'https://example.test/records/1',
      sourceArtifactsEvidence: [{
        url: 'https://example.test/api/records',
        retrievedAt: '2026-09-29T12:00:00.000Z',
        sha256: artifactHash,
        statusCode: 200,
        bodyCapture: 'complete-http-client-body',
        mediaType: 'application/json',
        byteLength: 11,
        etag: '"v1"',
      }],
      transformations: ['parse-json', 'normalize-record'],
      license: 'Configured terms note',
      licenseBasis: 'source-configuration',
    });

    assert.equal(bundle.provenanceEvidence.record_integrity.digest, bundle.sha256);
    assert.notEqual(bundle.provenanceEvidence.record_integrity.digest, artifactHash);
    assert.equal(bundle.provenanceEvidence.acquisition.status, 'captured');
    assert.equal(bundle.provenanceEvidence.acquisition.association, 'not-established');
    assert.equal(bundle.provenanceEvidence.acquisition.artifacts[0]?.association, 'not-established');
    assert.equal(bundle.provenanceEvidence.acquisition.artifacts[0]?.evidence_source, 'explicit-record-evidence');
    assert.equal(bundle.provenanceEvidence.acquisition.artifacts[0]?.sha256, artifactHash);
    assert.equal(bundle.provenanceEvidence.transformations.status, 'pipeline-reported');
    assert.equal(bundle.provenanceEvidence.transformations.coverage, 'declared-steps-only');
    assert.equal(bundle.provenanceEvidence.publisher_terms.status, 'source-configuration-only');
    assert.equal(bundle.provenanceEvidence.publisher_terms.label, null);
  });

  it('treats an explicitly supplied artifact that matches the source URL as URL-only association', async () => {
    const bundle = await buildClaimBundle({
      claim: 'URL-associated record',
      value: { id: 'matching' },
      sourceName: 'Example source',
      sourceUrl: 'https://example.test/api?query=record#section',
      sourceArtifactsEvidence: [{
        url: 'https://example.test/api?token=redacted',
        retrievedAt: '2026-09-29T12:00:00.000Z',
        sha256: artifactHash,
        statusCode: 200,
        bodyCapture: 'complete-http-client-body',
      }],
    });
    assert.equal(bundle.retrievedAt, '2026-09-29T12:00:00.000Z');
    assert.equal(bundle.provenanceEvidence.acquisition.association, 'url-matched-not-content-verified');
    assert.equal(bundle.provenanceEvidence.acquisition.artifacts[0]?.association, 'url-matched-not-content-verified');
  });

  it('preserves unavailable evidence as unknown rather than inferring rights or acquisition', async () => {
    const bundle = await buildClaimBundle({
      claim: 'No evidence yet',
      value: { id: 2 },
      sourceName: 'Example source',
      sourceUrl: 'https://example.test/record/2',
    });

    assert.equal(bundle.provenanceEvidence.acquisition.status, 'not-captured');
    assert.equal(bundle.provenanceEvidence.acquisition.association, 'none');
    assert.deepEqual(bundle.provenanceEvidence.acquisition.artifacts, []);
    assert.equal(bundle.provenanceEvidence.publisher_terms.status, 'not-observed');
    assert.equal(bundle.provenanceEvidence.publisher_terms.label, null);
    assert.equal(bundle.provenanceEvidence.publisher_terms.url, null);
    assert.equal(bundle.provenanceEvidence.transformations.status, 'not-recorded');
  });

  it('attaches only matching ambient captures and preserves explicit unmatched artifacts', async () => {
    citationStore.clear();
    const keysBefore = new Set(citationStore.keys());
    await withIngestionArtifactCapture(async () => {
      recordIngestionArtifact({
        url: 'https://example.test/api?token=secret',
        urlRedacted: true,
        retrievedAt: '2026-09-29T12:00:00.000Z',
        sha256: artifactHash,
        statusCode: 200,
        bodyCapture: 'complete-http-client-body',
      });
      recordIngestionArtifact({
        url: 'https://unrelated.example/api',
        retrievedAt: '2026-09-29T12:01:00.000Z',
        sha256: createHash('sha256').update('unrelated').digest('hex'),
        statusCode: 200,
        bodyCapture: 'complete-http-client-body',
      });
      await registerModuleClaims('evidence-test', [{
        id: 'r3',
        url: 'https://example.test/api#record',
        source_artifacts_evidence: [{
          url: 'https://explicit.example/manifest',
          retrievedAt: '2026-09-29T11:59:00.000Z',
          sha256: createHash('sha256').update('manifest').digest('hex'),
          statusCode: 200,
          bodyCapture: 'complete-http-client-body',
        }],
      }]);
    });

    // Identify this test's record by diffing against the store contents from
    // before the registration, instead of asserting on the store's total size.
    // citationStore is a module-level singleton shared with claims.test.ts and
    // node:test runs test files concurrently within a worker, so a bare
    // `keys().length === 1` races against that file's own writes. It passed in
    // isolation and failed roughly one full run in three.
    const added = citationStore.keys().filter(key => !keysBefore.has(key));
    assert.equal(added.length, 1, `expected one new record, saw ${added.length} (store holds ${citationStore.keys().length})`);
    const stored = citationStore.get(added[0] ?? '');
    assert.ok(stored);
    const artifacts = stored.bundle.provenanceEvidence.acquisition.artifacts;
    assert.equal(artifacts.length, 2);
    assert.deepEqual(artifacts.map(artifact => artifact.association), [
      'not-established',
      'url-matched-not-content-verified',
    ]);
    assert.deepEqual(artifacts.map(artifact => artifact.evidence_source), [
      'explicit-record-evidence',
      'shared-http-client-capture',
    ]);
    assert.equal(artifacts[1]?.url, 'https://example.test/api');
    assert.equal(stored.bundle.provenanceEvidence.acquisition.association, 'url-matched-not-content-verified');
    assert.equal(stored.bundle.retrievedAt, '2026-09-29T12:00:00.000Z');
    citationStore.clear();
  });

  it('redacts query strings, fragments, and credentials from explicit artifact evidence', async () => {
    const bundle = await buildClaimBundle({
      claim: 'redacted explicit evidence',
      value: { id: 'redacted' },
      sourceName: 'Example',
      sourceUrl: 'https://user:password@example.test/api?token=source#fragment',
      sourceArtifactsEvidence: [{
        url: 'https://api-user:api-password@example.test/api?secret=artifact#details',
        retrievedAt: '2026-09-29T12:00:00.000Z',
        sha256: artifactHash,
        statusCode: 200,
        bodyCapture: 'complete-http-client-body',
      }],
    });
    const evidence = bundle.provenanceEvidence.acquisition.artifacts[0];
    assert.ok(evidence);
    assert.equal(evidence.url, 'https://example.test/api');
    assert.equal(evidence.url_redacted, true);
    assert.equal(bundle.sourceUrl, 'https://example.test/api');
    assert.equal(JSON.stringify(bundle).includes('password'), false);
    assert.equal(JSON.stringify(bundle).includes('token=source'), false);
    assert.equal(bundle.provenanceEvidence.acquisition.association, 'url-matched-not-content-verified');
  });

  it('does not URL-match empty, relative, malformed, or non-HTTP URLs', async () => {
    const artifact = {
      url: 'https://example.test/api',
      retrievedAt: '2026-09-29T12:00:00.000Z',
      sha256: artifactHash,
      statusCode: 200,
      bodyCapture: 'complete-http-client-body' as const,
    };
    for (const sourceUrl of ['', '/relative', 'not a url', 'ftp://example.test/api']) {
      const bundle = await buildClaimBundle({
        claim: 'invalid URL association',
        value: { sourceUrl },
        sourceName: 'Example',
        sourceUrl,
        sourceArtifactsEvidence: [artifact],
      });
      assert.equal(bundle.provenanceEvidence.acquisition.status, 'captured');
      assert.equal(bundle.provenanceEvidence.acquisition.association, 'not-established');
      assert.equal(bundle.provenanceEvidence.acquisition.artifacts[0]?.association, 'not-established');
      assert.equal(bundle.provenanceEvidence.acquisition.artifacts[0]?.evidence_source, 'explicit-record-evidence');
    }
  });

  it('returns null retrieval time when a claim is registered without acquisition evidence', async () => {
    citationStore.clear();
    await registerModuleClaims('timestamp-test', [{ id: 'r4', url: 'https://example.test/record' }]);
    const stored = citationStore.get(citationStore.keys()[0] ?? '');
    assert.ok(stored);
    assert.equal(stored.bundle.retrievedAt, undefined);
    assert.equal(stored.bundle.provenanceEvidence.acquisition.status, 'not-captured');
    citationStore.clear();
  });

  it('redacts secrets in stored legacy evidence while normalizing it', () => {
    const legacyStore = new CitationStore();
    const legacyValue = { legacy: true };
    const legacyHash = createHash('sha256').update(canonicalJson(legacyValue)).digest('hex');
    const raw = JSON.stringify({
      claim: 'Legacy record with unsafe URL',
      value: legacyValue,
      sourceName: 'Legacy source',
      sourceUrl: 'https://legacy.example/record',
      sha256: legacyHash,
      provenanceEvidence: {
        schema_version: 'quill.provenance.v1',
        record_integrity: {
          algorithm: 'SHA-256', digest: legacyHash, scope: 'canonical-json-record',
          canonicalization: 'quill-canonical-json-v1',
        },
        acquisition: {
          status: 'captured', association: 'not-established',
          artifacts: [{
            association: 'not-established', evidence_source: 'explicit-record-evidence',
            url: 'https://user:password@legacy.example/api?token=secret#private',
            retrieved_at: '2026-09-29T12:00:00.000Z', sha256: artifactHash,
            hash_scope: 'http-client-response-body-utf8', status_code: 200,
            media_type: null, byte_length: 11, etag: null, last_modified: null,
            url_redacted: false, body_capture: 'complete-http-client-body',
          }],
        },
        transformations: { status: 'not-recorded', coverage: 'declared-steps-only', steps: [], stages: {
          module_code_revision: null, parser_version: null, transform_code_revision: null,
        } },
        publisher_terms: { status: 'not-observed', label: null, url: null, observed_fields: [] },
      },
    });
    (legacyStore as any).memory.set(legacyHash, {
      hash: legacyHash,
      serialized: canonicalJson(legacyValue),
      citation_json: raw,
      created_at: '2026-09-29T12:00:00.000Z',
    });
    const stored = legacyStore.get(legacyHash);
    assert.ok(stored);
    const artifact = stored.bundle.provenanceEvidence.acquisition.artifacts[0];
    assert.ok(artifact);
    assert.equal(artifact.url, 'https://legacy.example/api');
    assert.equal(artifact.url_redacted, true);
    assert.equal(artifact.url.includes('secret'), false);
    assert.equal(JSON.stringify(stored.bundle).includes('password'), false);
    assert.equal(JSON.stringify(stored.bundle).includes('token=secret'), false);
    assert.equal(stored.bundle.retrievedAt, undefined);
  });

  it('normalizes a legacy bundle without fabricating retrieval evidence', () => {
    const legacyStore = new CitationStore();
    const legacyValue = { legacy: true };
    const legacyHash = createHash('sha256').update(canonicalJson(legacyValue)).digest('hex');
    const raw = JSON.stringify({
      claim: 'Legacy record',
      value: legacyValue,
      sourceName: 'Legacy source',
      sourceUrl: 'https://legacy.example/record',
      retrievedAt: '2020-01-01T00:00:00.000Z',
      sha256: legacyHash,
    });
    (legacyStore as any).memory.set(legacyHash, {
      hash: legacyHash,
      serialized: canonicalJson(legacyValue),
      citation_json: raw,
      created_at: '2026-09-29T12:00:00.000Z',
    });
    const stored = legacyStore.get(legacyHash);
    assert.ok(stored);
    assert.equal(stored.bundle.sha256, legacyHash);
    assert.equal(stored.bundle.retrievedAt, undefined);
    assert.equal(stored.bundle.provenanceEvidence.schema_version, 'quill.provenance.v1');
    assert.equal(stored.bundle.provenanceEvidence.acquisition.status, 'not-captured');
  });

  it('retains all same-URL artifacts in capture order', async () => {
    const secondHash = createHash('sha256').update('second').digest('hex');
    const bundle = await buildClaimBundle({
      claim: 'retry evidence',
      value: { id: 'retry' },
      sourceName: 'Example',
      sourceUrl: 'https://example.test/api',
    }, { capturedArtifactsEvidence: [
      { url: 'https://example.test/api?attempt=1', retrievedAt: '2026-09-29T12:00:00Z', sha256: artifactHash, statusCode: 503, bodyCapture: 'complete-http-client-body', urlRedacted: true },
      { url: 'https://example.test/api?attempt=2', retrievedAt: '2026-09-29T12:00:01Z', sha256: secondHash, statusCode: 200, bodyCapture: 'complete-http-client-body', urlRedacted: true },
    ] });
    assert.deepEqual(bundle.provenanceEvidence.acquisition.artifacts.map(item => item.sha256), [artifactHash, secondHash]);
    assert.deepEqual(bundle.provenanceEvidence.acquisition.artifacts.map(item => item.evidence_source), [
      'shared-http-client-capture',
      'shared-http-client-capture',
    ]);
  });
});
