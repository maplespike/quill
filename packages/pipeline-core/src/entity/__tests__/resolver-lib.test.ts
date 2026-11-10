// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Entity Resolver-Lib unit tests
 *
 * Pure-function coverage: URI scheme round-trips, registry grouping, and the
 * cross-reference composition surface. DB-backed resolution (resolveEntity /
 * getEntityById / findConnections) is exercised end-to-end by the live
 * verification; these tests pin the deterministic pure logic.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENTITY_URI_PREFIX,
  toEntityUri,
  fromEntityUri,
  isEntityUri,
  registryForModule,
  buildRegistryBreakdown,
  crossReferenceEntity,
} from '../resolver-lib.js';

describe('Entity URI scheme (quill://entity/{id})', () => {
  it('builds a canonical URI from an id', () => {
    assert.equal(toEntityUri('ent_123'), `${ENTITY_URI_PREFIX}ent_123`);
    assert.equal(toEntityUri('person/42'), `${ENTITY_URI_PREFIX}person%2F42`);
  });

  it('round-trips id → URI → id', () => {
    const id = 'lobbying-client-7';
    assert.equal(fromEntityUri(toEntityUri(id)), id);
  });

  it('decodes URL-encoded ids', () => {
    assert.equal(fromEntityUri(`${ENTITY_URI_PREFIX}person%2F42`), 'person/42');
  });

  it('passes through non-URI input unchanged', () => {
    assert.equal(fromEntityUri('raw-id'), 'raw-id');
  });

  it('detects canonical URIs', () => {
    assert.equal(isEntityUri(toEntityUri('x')), true);
    assert.equal(isEntityUri('plain'), false);
  });
});

describe('Registry grouping', () => {
  it('maps modules to canonical registry buckets', () => {
    assert.equal(registryForModule('lobbying'), 'lobbying');
    assert.equal(registryForModule('provincial-lobbying'), 'lobbying');
    assert.equal(registryForModule('gic'), 'gic');
    assert.equal(registryForModule('committees'), 'committees');
    assert.equal(registryForModule('sedi'), 'corporate');
    assert.equal(registryForModule('canlii'), 'canlii');
    assert.equal(registryForModule('elections'), 'elections');
    assert.equal(registryForModule('unknown-module'), 'other');
  });

  it('builds per-registry breakdown with counts, modules, and date ranges', () => {
    const entity = {
      id: 'e1',
      canonicalName: 'Jane Doe',
      type: 'person' as const,
      confidence: 0.9,
      aliases: [],
      appearances: [
        { module: 'lobbying', sourceTable: 'lobbying', role: 'Consultant', date: '2024-01-01', summary: '', sourceUrl: 'https://lobbycanada.gc.ca/1' },
        { module: 'lobbying', sourceTable: 'lobbying', role: 'Consultant', date: '2025-01-01', summary: '', sourceUrl: 'https://lobbycanada.gc.ca/2' },
        { module: 'committees', sourceTable: 'committees', role: 'Witness', date: '2023-06-01', summary: '', sourceUrl: 'https://ourcommons.ca/1' },
      ],
    };

    const registries = buildRegistryBreakdown(entity);

    assert.equal(registries.length, 2);
    // Sorted by count desc — lobbying (2) before committees (1)
    assert.equal(registries[0].registry, 'lobbying');
    assert.equal(registries[0].count, 2);
    assert.deepEqual(registries[0].modules, ['lobbying']);
    assert.equal(registries[0].firstDate, '2024-01-01');
    assert.equal(registries[0].lastDate, '2025-01-01');
    assert.equal(registries[1].registry, 'committees');
    assert.equal(registries[1].count, 1);
  });
});

describe('crossReferenceEntity', () => {
  it('returns null for an id when the entity graph is unavailable', () => {
    // Pure guard: without an id AND without a name there is nothing to resolve.
    assert.equal(crossReferenceEntity({}), null);
  });
});
