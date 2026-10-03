/**
 * Quill — Claim Verification Route tests
 *
 * Covers GET /v1/claims/verify/:hash (public trust primitive) and
 * POST /v1/claims/verify (recompute):
 *  - invalid hash → 400
 *  - unknown hash → 200 { verified: false, found: false }
 *  - store-backed hash → 200 with full provenance (source, retrieved_at,
 *    license, verify_command)
 *  - POST recompute matches/mismatches claimed hash
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeCtx as makeBaseCtx } from './_helpers.js';

// The CitationStore persists to the shared SQLite DB (getRawDb) — which
// CREATES maplespike.sqlite at CWD if absent. Clean up so the suite doesn't
// pollute packages/api-server/. Resolve relative to THIS test file (never
// process.cwd()) so a repo-root invocation can't delete the shared DB.
const API_SERVER_PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
after(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      const target = resolve(API_SERVER_PKG, `maplespike.sqlite${suffix}`);
      if (target.startsWith(API_SERVER_PKG + sep)) {
        rmSync(target, { force: true });
      }
    } catch {
      // best-effort cleanup
    }
  }
});

const VALID_HASH = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

function makeCtx(tier: string = 'free') {
  return makeBaseCtx({ tenant: { tier } });
}

describe('Claim Verification Routes', () => {
  it('GET /claims/verify rejects invalid hash with 400', async () => {
    const { getVerifyClaimHandler } = await import('../routes/citation.js');
    const ctx = makeCtx();
    const req = new Request('http://localhost/v1/claims/verify/not-a-hash');
    const resp = await getVerifyClaimHandler(req, ctx as any, { hash: 'not-a-hash' });
    assert.equal(resp.status, 400);
    const body = await resp.json();
    assert.equal(body.error.code, 'INVALID_HASH');
  });

  it('GET /claims/verify returns verified:false for unknown hash', async () => {
    const { getVerifyClaimHandler } = await import('../routes/citation.js');
    const ctx = makeCtx();
    const req = new Request(`http://localhost/v1/claims/verify/${VALID_HASH}`);
    const resp = await getVerifyClaimHandler(req, ctx as any, { hash: VALID_HASH });
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.equal(body.success, true);
    assert.equal(body.data.verified, false);
    assert.equal(body.data.found, false);
    assert.equal(body.data.sha256, VALID_HASH);
  });

  it('GET /claims/verify returns full provenance for a store-backed hash', async () => {
    // Seed the shared claim store with a bundle (memory fallback path).
    const { buildClaimBundle, citationStore } = await import('@maplespike/pipeline-core');
    const bundle = await buildClaimBundle({
      claim: 'Unemployment rate was 6.5% in January 2025',
      value: { unemployment_rate: 6.5, period: '2025-01' },
      sourceName: 'Statistics Canada',
      sourceUrl: 'https://www.statcan.gc.ca/en/labour',
      sourceArtifactsEvidence: [{
        url: 'https://www.statcan.gc.ca/en/labour?api_key=secret',
        retrievedAt: '2026-09-29T12:00:00.000Z',
        sha256: 'b'.repeat(64),
        statusCode: 200,
        bodyCapture: 'complete-http-client-body',
      }],
      license: 'Terms label observed in source metadata',
      licenseBasis: 'publisher-metadata',
      publisherTermsEvidence: {
        label: 'OGL-C',
        url: 'https://example.test/terms',
        observedFields: ['license_title', 'license_url'],
      },
      updateFrequency: 'monthly',
    });
    citationStore.put(bundle);
    try {
      const { getVerifyClaimHandler } = await import('../routes/citation.js');
      const ctx = makeCtx();
      const req = new Request(`http://localhost/v1/claims/verify/${bundle.sha256}`);
      const resp = await getVerifyClaimHandler(req, ctx as any, { hash: bundle.sha256 });
      assert.equal(resp.status, 200);
      const body = await resp.json();
      const data = body.data;
      assert.equal(data.verified, true);
      assert.equal(data.found, true);
      assert.equal(data.sha256, bundle.sha256);
      assert.equal(data.source, 'Statistics Canada');
      assert.equal(data.source_name, 'Statistics Canada');
      assert.equal(data.source_url, 'https://www.statcan.gc.ca/en/labour');
      assert.equal(data.retrieved_at, '2026-09-29T12:00:00.000Z');
      assert.equal(data.verification_scope, 'claim-store-hash-match');
      assert.equal(data.provenance_evidence.acquisition.artifacts[0].url, 'https://www.statcan.gc.ca/en/labour');
      assert.equal(data.provenance_evidence.acquisition.artifacts[0].url_redacted, true);
      assert.equal(JSON.stringify(data).includes('api_key=secret'), false);
      assert.equal(data.license, 'Terms label observed in source metadata');
      assert.equal(data.provenance_evidence.schema_version, 'quill.provenance.v1');
      assert.equal(data.provenance_evidence.publisher_terms.status, 'publisher-metadata-observed');
      assert.equal(data.provenance_evidence.publisher_terms.label, 'OGL-C');
      assert.equal(data.provenance_evidence.acquisition.status, 'captured');
      assert.equal(data.update_frequency, 'monthly');
      assert.match(data.verify_command, /^echo -n '.*' \| sha256sum$/);
    } finally {
      citationStore.clear();
    }
  });

  it('GET /claims/verify accepts sha256: prefixed hash', async () => {
    const { getVerifyClaimHandler } = await import('../routes/citation.js');
    const ctx = makeCtx();
    const req = new Request(`http://localhost/v1/claims/verify/sha256:${VALID_HASH}`);
    const resp = await getVerifyClaimHandler(req, ctx as any, { hash: `sha256:${VALID_HASH}` });
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.equal(body.data.sha256, VALID_HASH);
  });

  it('POST /claims/verify recomputes hash and confirms match', async () => {
    const { postVerifyClaimHandler } = await import('../routes/citation.js');
    const ctx = makeCtx();
    const data = { a: 1, b: [1, 2, 3] };
    const req = new Request('http://localhost/v1/claims/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, sha256: 'irrelevant' }),
    });
    const resp = await postVerifyClaimHandler(req, ctx as any, {});
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.equal(body.data.matches_claimed, null); // claimed hash invalid → no comparison
    assert.match(body.data.recomputed_sha256, /^[a-f0-9]{64}$/);
  });

  it('POST /claims/verify detects a mismatch', async () => {
    const { postVerifyClaimHandler } = await import('../routes/citation.js');
    const ctx = makeCtx();
    const data = { a: 1, b: [1, 2, 3] };
    // Wrong claimed hash — must not match the recomputed canonical hash.
    const req = new Request('http://localhost/v1/claims/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, sha256: VALID_HASH }),
    });
    const resp = await postVerifyClaimHandler(req, ctx as any, {});
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.equal(body.data.matches_claimed, false);
    assert.equal(body.data.verified, false);
  });

  it('POST /claims/verify rejects missing data with 400', async () => {
    const { postVerifyClaimHandler } = await import('../routes/citation.js');
    const ctx = makeCtx();
    const req = new Request('http://localhost/v1/claims/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const resp = await postVerifyClaimHandler(req, ctx as any, {});
    assert.equal(resp.status, 400);
    const body = await resp.json();
    assert.equal(body.error.code, 'INVALID_BODY');
  });

  it('POST /claims/verify rejects oversized bodies with 413 (public-route abuse guard)', async () => {
    const { postVerifyClaimHandler } = await import('../routes/citation.js');
    const ctx = makeCtx();
    const big = JSON.stringify({ data: { blob: 'x'.repeat(2 * 1024 * 1024) } });
    const req = new Request('http://localhost/v1/claims/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'content-length': String(big.length) },
      body: big,
    });
    const resp = await postVerifyClaimHandler(req, ctx as any, {});
    assert.equal(resp.status, 413);
  });
});

describe('Legacy claim bundles without v1 evidence', () => {
  /**
   * Pre-v1 rows carry a bare `retrievedAt` (registration time) and no
   * `provenanceEvidence`. The store decoder normalizes them, and the API must
   * serialize the result honestly: retrieval time null, acquisition
   * not-captured, publisher terms not-observed — never a reconstructed
   * timestamp or an implied publisher declaration.
   */
  async function seedLegacyBundle() {
    const { buildClaimBundle, citationStore } = await import('@maplespike/pipeline-core');
    const fresh = await buildClaimBundle({
      claim: 'Legacy claim registered before v1 evidence',
      value: { legacy: true, year: 2024 },
      sourceName: 'Legacy Publisher Registry',
      sourceUrl: 'https://legacy.example.test/dataset',
    });
    const { provenanceEvidence: _dropped, ...legacyRest } = fresh;
    const legacy = {
      ...legacyRest,
      // Simulate the old row shape: registration time stored as retrievedAt.
      retrievedAt: '2026-01-02T03:04:05.000Z',
    } as unknown as typeof fresh;
    citationStore.put(legacy);
    return { citationStore, legacy, hash: fresh.sha256 };
  }

  it('GET /claims/verify serializes missing evidence as null/not-observed, not a reconstructed time', async () => {
    const { citationStore, hash } = await seedLegacyBundle();
    try {
      const { getVerifyClaimHandler } = await import('../routes/citation.js');
      const ctx = makeCtx();
      const req = new Request(`http://localhost/v1/claims/verify/${hash}`);
      const resp = await getVerifyClaimHandler(req, ctx as any, { hash });
      assert.equal(resp.status, 200);
      const data = (await resp.json()).data;

      // Record integrity still resolves; source authentication does not.
      assert.equal(data.verified, true);
      assert.equal(data.found, true);
      assert.equal(data.verification_scope, 'claim-store-hash-match');

      // The legacy registration time must not surface as a retrieval time.
      assert.equal(data.retrieved_at, null);

      const ev = data.provenance_evidence;
      assert.equal(ev.schema_version, 'quill.provenance.v1');
      assert.equal(ev.acquisition.status, 'not-captured');
      assert.equal(ev.acquisition.association, 'none');
      assert.deepEqual(ev.acquisition.artifacts, []);
      assert.equal(ev.publisher_terms.status, 'not-observed');
      assert.equal(ev.publisher_terms.label, null);
      assert.equal(ev.publisher_terms.url, null);
      assert.equal(ev.transformations.status, 'not-recorded');
      assert.equal(data.license_basis, 'no-publisher-declaration');
    } finally {
      citationStore.clear();
    }
  });

  it('GET /claims/latest reports retrieved_at null for the legacy row', async () => {
    const { citationStore, hash } = await seedLegacyBundle();
    try {
      const { getLatestClaimsHandler } = await import('../routes/citation.js');
      const ctx = makeCtx();
      const req = new Request('http://localhost/v1/claims/latest');
      const resp = await getLatestClaimsHandler(req, ctx as any, {});
      assert.equal(resp.status, 200);
      const claims = (await resp.json()).data.claims;
      const found = claims.find((c: { sha256: string }) => c.sha256 === `sha256:${hash}`);
      assert.ok(found, 'legacy claim should be listed');
      assert.equal(found.retrieved_at, null);
    } finally {
      citationStore.clear();
    }
  });
});

describe('Claims Index (GET /v1/claims/latest)', () => {
  it('returns empty list when the store has no bundles', async () => {
    const { citationStore } = await import('@maplespike/pipeline-core');
    citationStore.clear();
    const { getLatestClaimsHandler } = await import('../routes/citation.js');
    const ctx = makeCtx();
    const req = new Request('http://localhost/v1/claims/latest');
    const resp = await getLatestClaimsHandler(req, ctx as any, {});
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.equal(body.success, true);
    assert.equal(body.data.count, 0);
    assert.deepEqual(body.data.claims, []);
  });

  it('returns seeded bundles with full provenance, newest first', async () => {
    const { buildClaimBundle, citationStore } = await import('@maplespike/pipeline-core');
    const older = await buildClaimBundle({
      claim: 'Older claim',
      value: { v: 1 },
      sourceName: 'Elections Canada',
      sourceUrl: 'https://www.elections.ca/',
    });
    const newer = await buildClaimBundle({
      claim: 'Newer claim',
      value: { v: 2 },
      sourceName: 'Statistics Canada',
      sourceUrl: 'https://www.statcan.gc.ca/',
      license: 'Open Government Licence – Canada',
      updateFrequency: 'monthly',
    });
    citationStore.put(older);
    // Space the registrations so created_at differs — two puts in the same
    // millisecond would tie on the ORDER BY and fall back to the hash
    // tie-break, making the newest-first assertion nondeterministic.
    await new Promise((r) => setTimeout(r, 5));
    citationStore.put(newer);
    try {
      const { getLatestClaimsHandler } = await import('../routes/citation.js');
      const ctx = makeCtx();
      const req = new Request('http://localhost/v1/claims/latest');
      const resp = await getLatestClaimsHandler(req, ctx as any, {});
      assert.equal(resp.status, 200);
      const body = await resp.json();
      assert.equal(body.success, true);
      assert.equal(body.data.count, 2);
      const claims = body.data.claims;
      assert.equal(claims[0].sha256, `sha256:${newer.sha256}`);
      assert.equal(claims[0].claim, 'Newer claim');
      assert.equal(claims[0].source_name, 'Statistics Canada');
      assert.equal(claims[0].source_url, 'https://www.statcan.gc.ca/');
      assert.equal(claims[0].retrieved_at, null);
      assert.equal(claims[0].provenance_status, 'inspect-verification-endpoint');
      assert.equal(claims[0].license, 'Open Government Licence – Canada');
      assert.equal(claims[0].update_frequency, 'monthly');
      assert.equal(claims[1].sha256, `sha256:${older.sha256}`);
    } finally {
      citationStore.clear();
    }
  });
});
