/**
 * Run the SDK examples against mocks.
 *
 * The examples are documentation that developers copy — this test keeps them
 * honest: the import fails if an example is deleted, and the mocked calls pin
 * the request shape (URL + body) they demonstrate.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SAMPLE_CLAIM,
  canonicalJson,
  lookupClaim,
  sha256Hex,
  verifyClaim,
  type FetchLike,
} from '../examples/verify-claim.js';
import {
  crossrefAgent,
  entityLinks,
  resolveEntity,
  type EntityLinksResult,
  type ResolveClient,
} from '../examples/crossref-agent.js';

const EXAMPLES = dirname(fileURLToPath(import.meta.url)).replace(/\/tests$/, '/examples');

function envelope<T>(data: T) {
  return {
    data,
    meta: {
      requestId: 'req_test',
      agent: 'test',
      action: 'test',
      authMethod: 'none' as const,
      creditsCharged: 0,
      cacheStatus: 'mock' as const,
      durationMs: 0,
    },
    quality: {
      freshness_seconds: 0,
      source_uptime_7d: 1,
      confidence: 1,
      certainty_score: 1,
    },
    citation: {
      source_name: 'test',
      source_url: 'https://example.test',
      license: 'test',
      data_hash: 'sha256:test',
      retrieved_at: null,
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const LINKS_RESULT: EntityLinksResult = {
  entity: {
    id: 'ent_1',
    uri: 'quill://entity/ent_1',
    canonicalName: 'Acme Consulting Inc.',
    type: 'organization',
    confidence: 'high',
  },
  registries: [
    { registry: 'lobbying', count: 3, modules: ['lobbying'] },
    { registry: 'corporate', count: 1, modules: ['corporate'] },
  ],
  totalAppearances: 4,
  connections: [{ name: 'Acme Holdings', relationship: 'parent', confidence: 'high' }],
  connectionCount: 1,
  summary: 'Acme Consulting Inc. appears in 4 record(s) across 2 registry(/ies).',
};

const fakeClient: ResolveClient = {
  entityResolution: {
    async resolve() {
      return envelope([
        { entityId: 'ent_low', name: 'Acme Consulting', type: 'company', confidence: 'low', matches: [] },
        { entityId: 'ent_1', name: 'Acme Consulting Inc.', type: 'company', confidence: 'high', matches: [] },
      ]);
    },
  },
};

describe('sdk examples', () => {
  it('ships both example files', () => {
    for (const file of ['verify-claim.ts', 'crossref-agent.ts']) {
      assert.ok(existsSync(join(EXAMPLES, file)), `${file} must exist`);
    }
  });

  it('verify-claim canonicalises JSON and hashes deterministically', () => {
    assert.equal(canonicalJson({ b: 2, a: 1 }), '{"a":1,"b":2}');
    assert.equal(canonicalJson({ nested: [{ z: 1, a: 2 }] }), '{"nested":[{"a":2,"z":1}]}');
    assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('verify-claim posts data + claimed hash to /v1/claims/verify', async () => {
    const hash = sha256Hex(canonicalJson(SAMPLE_CLAIM));
    let seenUrl = '';
    let seenBody: { data?: unknown; sha256?: string } = {};
    const fetchImpl: FetchLike = async (url, init) => {
      seenUrl = url;
      seenBody = JSON.parse(String(init?.body ?? '{}'));
      return jsonResponse(envelope({
        verified: true,
        recomputed_sha256: hash,
        matches_claimed: true,
        verify_command: `echo -n '<canonical>' | sha256sum`,
      }));
    };

    const result = await verifyClaim({ data: SAMPLE_CLAIM, sha256: hash, baseUrl: 'https://api.test', fetchImpl });
    assert.equal(seenUrl, 'https://api.test/v1/claims/verify');
    assert.equal(seenBody.sha256, hash);
    assert.deepEqual(seenBody.data, SAMPLE_CLAIM);
    assert.equal(result.data.verified, true);
    assert.equal(result.data.matches_claimed, true);
  });

  it('lookupClaim strips the sha256: prefix from the path', async () => {
    let seenUrl = '';
    const fetchImpl: FetchLike = async (url) => {
      seenUrl = url;
      return jsonResponse(envelope({
        verified: true, found: true, sha256: 'a'.repeat(64), source: 'hoc',
        source_name: 'House of Commons', source_url: 'https://example.test', retrieved_at: null, license: null,
      }));
    };

    await lookupClaim({ hash: `sha256:${'a'.repeat(64)}`, baseUrl: 'https://api.test/', fetchImpl });
    assert.equal(seenUrl, `https://api.test/v1/claims/verify/${'a'.repeat(64)}`);
  });

  it('crossref-agent resolves the best match then reads /v1/entities/{id}/links', async () => {
    let seenUrl = '';
    const fetchImpl: FetchLike = async (url) => {
      seenUrl = url;
      return jsonResponse(envelope(LINKS_RESULT));
    };

    const resolved = await resolveEntity({ name: 'Acme', client: fakeClient });
    assert.equal(resolved?.entityId, 'ent_1', 'highest-confidence match wins');

    const report = await crossrefAgent({
      name: 'Acme',
      type: 'organization',
      client: fakeClient,
      baseUrl: 'https://api.test',
      fetchImpl,
    });
    assert.equal(seenUrl, 'https://api.test/v1/entities/ent_1/links?type=organization');
    assert.equal(report.summary, LINKS_RESULT.summary);
    assert.equal(report.links.connectionCount, 1);

    const links = await entityLinks({ entityId: 'quill://entity/ent_1', baseUrl: 'https://api.test', fetchImpl });
    assert.equal(links.data.entity.uri, 'quill://entity/ent_1');
  });

  it('crossref-agent refuses to guess below the confidence threshold', async () => {
    const lowOnly: ResolveClient = {
      entityResolution: {
        async resolve() {
          return envelope([
            { entityId: 'ent_low', name: 'Acme', type: 'company', confidence: 'low', matches: [] },
          ]);
        },
      },
    };
    assert.equal(await resolveEntity({ name: 'Acme', client: lowOnly }), null);
    await assert.rejects(
      () => crossrefAgent({ name: 'Acme', client: lowOnly, fetchImpl: async () => jsonResponse({}) }),
      /No entity matched/,
    );
  });
});
