// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Public GET /v1/citation/:hash must not echo a restricted source's stored
 * record. Open sources still return the canonical record so the hash can be
 * checked. The claim store is seeded in memory; these tests make no network
 * calls.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeCtx as makeBaseCtx } from './_helpers.js';

const API_SERVER_PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
after(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      const target = resolve(API_SERVER_PKG, `quill.sqlite${suffix}`);
      if (target.startsWith(API_SERVER_PKG + sep)) {
        rmSync(target, { force: true });
      }
    } catch {
      // best-effort cleanup
    }
  }
});

const OPEN_BODY = 'OPEN_SOURCE_BODY_bank-rate-decision-text';
const RESTRICTED_BODY = 'RESTRICTED_COMMITTEE_TRANSCRIPT_do-not-serve';

async function seed(sourceName: string, value: Record<string, unknown>, sourceUrl: string) {
  const { buildClaimBundle, citationStore } = await import('@maplespike/pipeline-core');
  const bundle = await buildClaimBundle({
    claim: `${sourceName} record`,
    value,
    sourceName,
    sourceUrl,
    attributionText: `Stored attribution for ${sourceName}.`,
  });
  citationStore.put(bundle);
  return bundle;
}

describe('GET /v1/citation/:hash source policy', () => {
  it('returns the stored record for an open source', async () => {
    const { citationStore } = await import('@maplespike/pipeline-core');
    citationStore.clear();
    const bundle = await seed(
      'bank-of-canada',
      {
        title: 'Policy rate',
        text: OPEN_BODY,
        url: 'https://www.bankofcanada.ca/rates/',
      },
      'https://www.bankofcanada.ca/rates/',
    );
    try {
      const { getCitationHandler } = await import('../routes/citation.js');
      const resp = await getCitationHandler(
        new Request(`http://localhost/v1/citation/${bundle.sha256}`),
        makeBaseCtx() as never,
        { id: bundle.sha256 },
      );
      assert.equal(resp.status, 200);
      const body = await resp.json();
      const raw = JSON.stringify(body);
      assert.equal(body.data.verified, true);
      assert.equal(body.data.citation.data_hash, bundle.sha256);
      assert.equal(body.data.citation.source_url, 'https://www.bankofcanada.ca/rates/');
      assert.match(body.data.verify_command, new RegExp(OPEN_BODY));
      assert.ok(raw.includes(OPEN_BODY), 'open sources keep the stored text so the hash can be checked');
    } finally {
      citationStore.clear();
    }
  });

  it('returns only the hash, source link, and attribution for a restricted source', async () => {
    const { citationStore } = await import('@maplespike/pipeline-core');
    citationStore.clear();
    const bundle = await seed(
      'committees',
      {
        title: 'FINA evidence',
        text: RESTRICTED_BODY,
        transcript: 'second copy of the speech',
        summary: 'S'.repeat(500),
        url: 'https://www.ourcommons.ca/DocumentViewer/en/44-1/FINA/meeting-1/evidence',
      },
      'https://www.ourcommons.ca/DocumentViewer/en/44-1/FINA/meeting-1/evidence',
    );
    try {
      const { getCitationHandler } = await import('../routes/citation.js');
      const resp = await getCitationHandler(
        new Request(`http://localhost/v1/citation/sha256:${bundle.sha256}`),
        makeBaseCtx() as never,
        { id: `sha256:${bundle.sha256}` },
      );
      assert.equal(resp.status, 200);
      const body = await resp.json();
      const raw = JSON.stringify(body);
      assert.equal(body.data.verified, true);
      assert.equal(body.data.verification_scope, 'claim-store-hash-match');
      assert.equal(body.data.citation.data_hash, bundle.sha256);
      assert.equal(
        body.data.citation.source_url,
        'https://www.ourcommons.ca/DocumentViewer/en/44-1/FINA/meeting-1/evidence',
      );
      assert.match(body.data.citation.attribution_text, /Stored attribution for committees/);
      assert.match(body.data.citation.attribution_text, /Speaker's Permission/);
      assert.equal(body.data.verify_command, undefined);
      assert.equal(body.data.record, undefined);
      assert.equal(raw.includes(RESTRICTED_BODY), false);
      assert.equal(raw.includes('second copy of the speech'), false);
      assert.equal(raw.includes('S'.repeat(80)), false);
    } finally {
      citationStore.clear();
    }
  });
});
