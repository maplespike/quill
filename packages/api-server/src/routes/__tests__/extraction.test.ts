// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Extraction Route Tests — MapleSpike API Server
 *
 * Tests the client-side browser extraction system:
 *   - GET /v1/extraction/tasks returns the correct sources
 *   - POST /v1/extraction/results stores extracted data
 *   - GET /v1/extraction/cached/:source_id retrieves stored data
 */

import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeGetRequest(url: string): Request {
  return new Request(url, { method: 'GET' });
}

function makePostRequest(url: string, body: Record<string, unknown>): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/* ------------------------------------------------------------------ */
/*  Test context                                                       */
/* ------------------------------------------------------------------ */

const ctx = {
  tenant: { id: 'test-tenant', tier: 'free' as const },
  requestId: 'req-ext-1',
  startTime: Date.now(),
} as unknown as import('../../types.js').RouteContext;

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('Extraction Routes', () => {
  let extractionTasksHandler: import('../../types.js').RouteHandler;
  let extractionResultsHandler: import('../../types.js').RouteHandler;
  let extractionCachedHandler: import('../../types.js').RouteHandler;
  let _clearExtractionCache: () => void;

  before(async () => {
    const mod = await import('../extraction.js');
    extractionTasksHandler = mod.extractionTasksHandler;
    extractionResultsHandler = mod.extractionResultsHandler;
    extractionCachedHandler = mod.extractionCachedHandler;
    _clearExtractionCache = mod._clearExtractionCache;
  });

  beforeEach(() => {
    // Start each test with a clean cache
    _clearExtractionCache();
  });

  after(() => {
    _clearExtractionCache();
  });

  /* --------------------------------------------------------------- */
  /*  GET /v1/extraction/tasks                                        */
  /* --------------------------------------------------------------- */

  describe('GET /v1/extraction/tasks', () => {
    it('returns all extraction sources as tasks', async () => {
      const resp = await extractionTasksHandler(
        makeGetRequest('http://localhost/v1/extraction/tasks'),
        ctx,
        {},
      );
      assert.equal(resp.status, 200);
      const body = await resp.json();
      assert.ok(body.success, 'response should be successful');
      assert.ok(Array.isArray(body.data.tasks), 'tasks should be an array');
      assert.ok(body.data.tasks.length >= 4, 'should have at least 4 sources');

      // Verify each task has the required fields
      for (const task of body.data.tasks) {
        assert.ok(task.source_id, 'task should have source_id');
        assert.ok(task.jurisdiction, 'task should have jurisdiction');
        assert.ok(task.name, 'task should have name');
        assert.ok(task.url, 'task should have url');
        assert.ok(task.extract_type, 'task should have extract_type');
        assert.ok(task.selector, 'task should have selector');
        assert.ok(task.instructions, 'task should have instructions');
        assert.equal(typeof task.cache_ttl_hours, 'number');
        assert.equal(typeof task.cached, 'boolean');
      }
    });

    it('includes all known sources', async () => {
      const resp = await extractionTasksHandler(
        makeGetRequest('http://localhost/v1/extraction/tasks'),
        ctx,
        {},
      );
      const body = await resp.json();
      const ids = body.data.tasks.map((t: { source_id: string }) => t.source_id);
      assert.ok(ids.includes('nwt-open-government'), 'should include NWT source');
      assert.ok(ids.includes('nunavut-bureau-statistics'), 'should include Nunavut Bureau source');
      assert.ok(ids.includes('nunavut-demographics'), 'should include Nunavut Demographics source');
      assert.ok(ids.includes('nunavut-economic'), 'should include Nunavut Economic source');
    });

    it('marks tasks as cached=false when no cache exists', async () => {
      const resp = await extractionTasksHandler(
        makeGetRequest('http://localhost/v1/extraction/tasks'),
        ctx,
        {},
      );
      const body = await resp.json();
      for (const task of body.data.tasks) {
        assert.equal(task.cached, false, `${task.source_id} should be uncached`);
        assert.equal(task.cached_at, null, `${task.source_id} should have null cached_at`);
      }
    });
  });

  /* --------------------------------------------------------------- */
  /*  GET /v1/extraction/tasks/:jurisdiction (path param)             */
  /* --------------------------------------------------------------- */

  describe('GET /v1/extraction/tasks/:jurisdiction (path param)', () => {
    it('filters tasks by jurisdiction (full name)', async () => {
      const resp = await extractionTasksHandler(
        makeGetRequest('http://localhost/v1/extraction/tasks/nunavut'),
        ctx,
        { jurisdiction: 'nunavut' },
      );
      assert.equal(resp.status, 200);
      const body = await resp.json();
      assert.ok(body.success);
      assert.ok(body.data.tasks.length > 0, 'should return nunavut tasks');
      for (const task of body.data.tasks) {
        assert.equal(task.jurisdiction, 'nunavut');
      }
    });

    it('filters tasks by jurisdiction (abbreviation)', async () => {
      const resp = await extractionTasksHandler(
        makeGetRequest('http://localhost/v1/extraction/tasks/nu'),
        ctx,
        { jurisdiction: 'nu' },
      );
      assert.equal(resp.status, 200);
      const body = await resp.json();
      assert.ok(body.success);
      assert.ok(body.data.tasks.length > 0, 'nu should map to nunavut');
      for (const task of body.data.tasks) {
        assert.equal(task.jurisdiction, 'nunavut');
      }
    });

    it('filters tasks for northwest-territories', async () => {
      const resp = await extractionTasksHandler(
        makeGetRequest('http://localhost/v1/extraction/tasks/nt'),
        ctx,
        { jurisdiction: 'nt' },
      );
      assert.equal(resp.status, 200);
      const body = await resp.json();
      assert.ok(body.success);
      assert.ok(body.data.tasks.length > 0, 'nt should map to northwest-territories');
      for (const task of body.data.tasks) {
        assert.equal(task.jurisdiction, 'northwest-territories');
      }
    });

    it('returns empty array for unknown jurisdiction', async () => {
      const resp = await extractionTasksHandler(
        makeGetRequest('http://localhost/v1/extraction/tasks/mars'),
        ctx,
        { jurisdiction: 'mars' },
      );
      assert.equal(resp.status, 200);
      const body = await resp.json();
      assert.ok(body.success);
      assert.equal(body.data.tasks.length, 0);
    });
  });

  /* --------------------------------------------------------------- */
  /*  GET /v1/extraction/tasks?jurisdiction= (query param)            */
  /* --------------------------------------------------------------- */

  describe('GET /v1/extraction/tasks?jurisdiction= (query param)', () => {
    it('filters tasks via query parameter', async () => {
      const resp = await extractionTasksHandler(
        makeGetRequest('http://localhost/v1/extraction/tasks?jurisdiction=nunavut'),
        ctx,
        {},
      );
      assert.equal(resp.status, 200);
      const body = await resp.json();
      assert.ok(body.success);
      assert.ok(body.data.tasks.length > 0);
      for (const task of body.data.tasks) {
        assert.equal(task.jurisdiction, 'nunavut');
      }
    });
  });

  /* --------------------------------------------------------------- */
  /*  POST /v1/extraction/results                                     */
  /* --------------------------------------------------------------- */

  describe('POST /v1/extraction/results', () => {
    it('stores extraction results and returns success', async () => {
      const results = [
        { title: 'Population Estimates 2024', url: 'https://www.gov.nu.ca/sites/default/files/pop2024.xlsx', format: 'XLSX' },
        { title: 'Birth Statistics', url: 'https://www.gov.nu.ca/sites/default/files/births.pdf', format: 'PDF' },
      ];
      const resp = await extractionResultsHandler(
        makePostRequest('http://localhost/v1/extraction/results', {
          source_id: 'nunavut-bureau-statistics',
          results,
        }),
        ctx,
        {},
      );
      assert.equal(resp.status, 200);
      const body = await resp.json();
      assert.ok(body.success);
      assert.equal(body.data.stored, true);
      assert.equal(body.data.source_id, 'nunavut-bureau-statistics');
      assert.equal(body.data.count, 2);
      assert.ok(body.data.cached_at, 'should return cached_at timestamp');
    });

    it('rejects missing source_id with 400', async () => {
      const resp = await extractionResultsHandler(
        makePostRequest('http://localhost/v1/extraction/results', {
          results: [{ title: 'Test', url: 'https://example.com', format: 'PDF' }],
        }),
        ctx,
        {},
      );
      assert.equal(resp.status, 400);
      const body = await resp.json();
      assert.equal(body.error.code, 'BAD_REQUEST');
    });

    it('rejects unknown source_id with 404', async () => {
      const resp = await extractionResultsHandler(
        makePostRequest('http://localhost/v1/extraction/results', {
          source_id: 'does-not-exist',
          results: [],
        }),
        ctx,
        {},
      );
      assert.equal(resp.status, 404);
      const body = await resp.json();
      assert.equal(body.error.code, 'NOT_FOUND');
    });

    it('rejects missing results array with 400', async () => {
      const resp = await extractionResultsHandler(
        makePostRequest('http://localhost/v1/extraction/results', {
          source_id: 'nunavut-bureau-statistics',
        }),
        ctx,
        {},
      );
      assert.equal(resp.status, 400);
      const body = await resp.json();
      assert.equal(body.error.code, 'BAD_REQUEST');
    });

    it('rejects malformed JSON with 400', async () => {
      const req = new Request('http://localhost/v1/extraction/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json {{{',
      });
      const resp = await extractionResultsHandler(req, ctx, {});
      assert.equal(resp.status, 400);
      const body = await resp.json();
      assert.equal(body.error.code, 'BAD_REQUEST');
    });
  });

  /* --------------------------------------------------------------- */
  /*  GET /v1/extraction/cached/:source_id                            */
  /* --------------------------------------------------------------- */

  describe('GET /v1/extraction/cached/:source_id', () => {
    it('returns 404 when no cache exists', async () => {
      const resp = await extractionCachedHandler(
        makeGetRequest('http://localhost/v1/extraction/cached/nunavut-bureau-statistics'),
        ctx,
        { source_id: 'nunavut-bureau-statistics' },
      );
      assert.equal(resp.status, 404);
      const body = await resp.json();
      assert.equal(body.error.code, 'NOT_FOUND');
    });

    it('returns cached results after POST', async () => {
      // First POST results
      const results = [
        { title: 'Population Estimates 2024', url: 'https://www.gov.nu.ca/sites/default/files/pop2024.xlsx', format: 'XLSX' },
        { title: 'Birth Statistics', url: 'https://www.gov.nu.ca/sites/default/files/births.pdf', format: 'PDF' },
      ];
      await extractionResultsHandler(
        makePostRequest('http://localhost/v1/extraction/results', {
          source_id: 'nunavut-bureau-statistics',
          results,
        }),
        ctx,
        {},
      );

      // Then GET cached
      const resp = await extractionCachedHandler(
        makeGetRequest('http://localhost/v1/extraction/cached/nunavut-bureau-statistics'),
        ctx,
        { source_id: 'nunavut-bureau-statistics' },
      );
      assert.equal(resp.status, 200);
      const body = await resp.json();
      assert.ok(body.success);
      assert.equal(body.data.source_id, 'nunavut-bureau-statistics');
      assert.equal(body.data.results.length, 2);
      assert.equal(body.data.results[0].title, 'Population Estimates 2024');
      assert.equal(body.data.results[0].format, 'XLSX');
      assert.ok(body.data.cached_at, 'should return cached_at');
      assert.equal(body.data.fresh, true);
      assert.ok(body.data.source_name, 'should include source metadata');
      assert.ok(body.data.jurisdiction, 'should include jurisdiction');
    });

    it('returns 404 for unknown source_id', async () => {
      const resp = await extractionCachedHandler(
        makeGetRequest('http://localhost/v1/extraction/cached/nonexistent'),
        ctx,
        { source_id: 'nonexistent' },
      );
      assert.equal(resp.status, 404);
      const body = await resp.json();
      assert.equal(body.error.code, 'NOT_FOUND');
    });

    it('overwrites previous results on re-POST', async () => {
      // POST initial results
      await extractionResultsHandler(
        makePostRequest('http://localhost/v1/extraction/results', {
          source_id: 'nunavut-economic',
          results: [{ title: 'Old', url: 'https://example.com/old.xlsx', format: 'XLSX' }],
        }),
        ctx,
        {},
      );

      // POST new results
      await extractionResultsHandler(
        makePostRequest('http://localhost/v1/extraction/results', {
          source_id: 'nunavut-economic',
          results: [
            { title: 'New 1', url: 'https://example.com/new1.xlsx', format: 'XLSX' },
            { title: 'New 2', url: 'https://example.com/new2.pdf', format: 'PDF' },
          ],
        }),
        ctx,
        {},
      );

      // GET cached — should have new results
      const resp = await extractionCachedHandler(
        makeGetRequest('http://localhost/v1/extraction/cached/nunavut-economic'),
        ctx,
        { source_id: 'nunavut-economic' },
      );
      assert.equal(resp.status, 200);
      const body = await resp.json();
      assert.equal(body.data.results.length, 2);
      assert.equal(body.data.results[0].title, 'New 1');
      assert.equal(body.data.results[1].title, 'New 2');
    });
  });

  /* --------------------------------------------------------------- */
  /*  Cache freshness reflected in tasks endpoint                     */
  /* --------------------------------------------------------------- */

  describe('Cache freshness in tasks endpoint', () => {
    it('marks source as cached=true after results POST', async () => {
      // Before POST: should be uncached
      const respBefore = await extractionTasksHandler(
        makeGetRequest('http://localhost/v1/extraction/tasks/nwt-open-government'),
        ctx,
        { jurisdiction: 'northwest-territories' },
      );
      const beforeBody = await respBefore.json();
      assert.equal(beforeBody.data.tasks[0].cached, false);

      // POST results
      await extractionResultsHandler(
        makePostRequest('http://localhost/v1/extraction/results', {
          source_id: 'nwt-open-government',
          results: [{ title: 'NWT Data', url: 'https://www.ece.gov.nt.ca/data.csv', format: 'CSV' }],
        }),
        ctx,
        {},
      );

      // After POST: should be cached
      const respAfter = await extractionTasksHandler(
        makeGetRequest('http://localhost/v1/extraction/tasks/nwt-open-government'),
        ctx,
        { jurisdiction: 'northwest-territories' },
      );
      const afterBody = await respAfter.json();
      assert.equal(afterBody.data.tasks[0].cached, true);
      assert.ok(afterBody.data.tasks[0].cached_at, 'should have cached_at timestamp');
    });
  });
});
