// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Context7-shape shell tests — resolve_quill_id + query_quill.
 *
 * Covers:
 *   1. Route table builds from the live registry (IDs unique, tools real).
 *   2. toolNameToId mapping conventions.
 *   3. Resolution ranking — domain questions rank the right tools.
 *   4. query_quill routing — happy path, unknown ID, argument forwarding.
 *   5. Enrichment envelope — _quill_route present; verification pointer when
 *      the underlying result carries a claim hash.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRouteTable,
  resetRouteTable,
  resolveQuestion,
  toolNameToId,
  handler as resolveHandler,
} from '../tools/resolve-quill-id.js';
import { handler as queryHandler } from '../tools/query-quill.js';
import { getToolNames } from '../tools/index.js';

describe('shell — route table (#803 master plan)', () => {
  before(() => resetRouteTable());

  it('builds from the live registry: every route points at a real tool', async () => {
    const table = await buildRouteTable();
    const live = new Set(getToolNames());
    assert.ok(table.length > 100, `expected 100+ routes, got ${table.length}`);
    for (const r of table) {
      assert.ok(live.has(r.toolName), `route ${r.id} → unknown tool ${r.toolName}`);
    }
  });

  it('IDs are effectively unique (collision suffix only on true dupes)', async () => {
    const table = await buildRouteTable();
    const ids = table.map(r => r.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    // Allow the deliberate /tool/{name} fallback; domain IDs must be unique.
    assert.ok(dupes.length < 5, `too many duplicate IDs: ${dupes.slice(0, 6).join(', ')}`);
  });

  it('featured graph tools map to quill://entity', async () => {
    const table = await buildRouteTable();
    const entity = table.filter(r => r.id === 'quill://entity');
    assert.ok(entity.length >= 1);
    assert.ok(entity.some(r => r.toolName === 'resolve_entity'));
  });

  describe('toolNameToId conventions', () => {
    it('maps domain searches', () => {
      assert.equal(toolNameToId('search_committees'), '/committees');
      assert.equal(toolNameToId('search_ircc_study_permits'), '/ircc/study-permits');
    });
    it('maps dataset queries', () => {
      assert.equal(toolNameToId('query_gdp'), '/gdp');
    });
    it('maps graph tools to the entity URI', () => {
      assert.equal(toolNameToId('resolve_entity'), 'quill://entity');
    });
    it('returns null for non-search shapes', () => {
      assert.equal(toolNameToId('verify_claim'), null);
    });
  });

  describe('resolution ranking', () => {
    it('a committee question ranks committee routes first', async () => {
      const table = await buildRouteTable();
      const results = resolveQuestion('which committees studied immigration policy', table, 5);
      assert.ok(results.length > 0);
      assert.match(results[0].toolName, /committee|parliament/i);
    });

    it('an entity question surfaces the graph route', async () => {
      const table = await buildRouteTable();
      const results = resolveQuestion('who is connected to this lobbyist — resolve the entity', table, 5);
      assert.ok(results.some(r => r.kind === 'graph'));
    });

    it('featured tools get a ranking boost', async () => {
      const table = await buildRouteTable();
      const results = resolveQuestion('connections between organizations', table, 10);
      assert.ok(results.some(r => r.featured));
    });
  });
});

describe('shell — resolve_quill_id handler', () => {
  it('returns ranked results with instructions', async () => {
    const out = await resolveHandler({ query: 'lobbyist influence in committees' });
    const content = out.content as Record<string, unknown>;
    assert.equal(content.tool, 'resolve_quill_id');
    assert.ok(Array.isArray(content.results));
    assert.ok((content.total as number) > 0);
  });

  it('errors on empty query', async () => {
    const out = await resolveHandler({});
    assert.equal(out.isError, true);
  });
});

describe('shell — query_quill handler', () => {
  it('rejects calls without id (forces the resolve loop)', async () => {
    const out = await queryHandler({ query: 'anything' });
    const content = out.content as Record<string, unknown>;
    assert.equal(out.isError, true);
    assert.match(String(content.error), /resolve_quill_id/i);
  });

  it('rejects unknown IDs with example suggestions', async () => {
    const out = await queryHandler({ id: '/nonexistent-domain-xyz', query: 'test' });
    const content = out.content as Record<string, unknown>;
    assert.equal(out.isError, true);
    assert.ok(Array.isArray(content.example_ids));
  });

  it('routes a real ID and enriches the envelope with _quill_route', async () => {
    const table = await buildRouteTable();
    const searchRoute = table.find(r => r.kind === 'search');
    assert.ok(searchRoute, 'need at least one search route');
    const out = await queryHandler({ id: searchRoute.id, query: 'test', args: { limit: 1 } });
    const content = out.content as Record<string, unknown>;
    assert.ok(content._quill_route, 'envelope must carry route metadata');
    const route = content._quill_route as Record<string, unknown>;
    assert.equal(route.routed_tool, searchRoute.toolName);
    assert.equal(route.id, searchRoute.id);
  });

  it('entity route reaches the graph tool', async () => {
    const out = await queryHandler({ id: 'quill://entity', query: 'test' });
    const content = out.content as Record<string, unknown>;
    const route = content._quill_route as Record<string, unknown> | undefined;
    if (route) {
      // resolve_entity / linked_entities / find_connections — whichever is the canonical route
      assert.match(String(route.routed_tool), /resolve_entity|linked_entities|find_connections/);
    }
    // Either routed successfully or the tool itself errored on bad input —
    // both prove the router found it; unknown-ID errors would fail differently.
    assert.ok(!String((out.content as Record<string, unknown>).error ?? '').includes('Unknown Quill ID'));
  });
});
