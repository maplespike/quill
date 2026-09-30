/**
 * Response Envelope Tests — MapleSpike API Server
 *
 * Tests response construction: success/error builders, citation enrichment,
 * CORS handling, token optimization, security headers, and rate-limit calc.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  enrichCitation,
  buildSuccess,
  buildError,
  getAllowedOrigin,
  jsonResponse,
  addRateLimitHeaders,
  corsPreflight,
  calcRateLimitReset,
  UNKNOWN_SOURCE_CITATION,
} from '../response.js';
import type { CitationMeta, BuildContext } from '../response.js';
import type { Tenant } from '../types.js';

/* ------------------------------------------------------------------ */
/*  Shared Test Context                                                */
/* ------------------------------------------------------------------ */

const TEST_TENANT: Tenant = {
  id: 'tenant-test-1',
  name: 'Test Tenant',
  email: 'test@example.com',
  emailVerified: true,
  tier: 'free',
  isActive: true,
  journalismMode: false,
};

function makeContext(overrides?: Partial<BuildContext>): BuildContext {
  return {
    tenant: TEST_TENANT,
    requestId: 'req-00000000-0000-0000-0000-000000000000',
    startTime: Date.now() - 100,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  enrichCitation                                                     */
/* ------------------------------------------------------------------ */

describe('enrichCitation', () => {
  it('adds citation_text and citation_footnote when missing', () => {
    const result = enrichCitation({
      source_name: 'Test Source',
      source_url: 'https://example.com/data',
      retrieved_at: new Date().toISOString(),
      data_hash: '',
      license: 'Publisher-declared: CC BY 4.0',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
      license_basis: 'publisher-metadata',
      attribution_text: 'Follow publisher wording.',
      update_frequency: 'daily',
    });
    assert.ok(result.citation_text);
    assert.ok(result.citation_footnote);
    assert.ok(result.citation_text!.includes('Test Source'));
    assert.ok(result.citation_text!.includes('https://example.com/data'));
  });

  it('does not override existing citation_text and citation_footnote', () => {
    const meta: CitationMeta = {
      source_name: 'Test',
      source_url: 'https://example.com',
      retrieved_at: new Date().toISOString(),
      data_hash: '',
      license: 'MIT',
      update_frequency: 'weekly',
      citation_text: 'Pre-existing text',
      citation_footnote: 'Pre-existing footnote',
    };
    const result = enrichCitation(meta);
    assert.equal(result.citation_text, 'Pre-existing text');
    assert.equal(result.citation_footnote, 'Pre-existing footnote');
  });

  it('sets original_format default to JSON when absent', () => {
    const result = enrichCitation({
      source_name: 'Source',
      source_url: 'https://example.com',
      retrieved_at: new Date().toISOString(),
      data_hash: '',
      license: 'OGL',
      update_frequency: 'daily',
    });
    assert.equal(result.original_format, 'JSON');
  });

  it('preserves original_format when provided', () => {
    const result = enrichCitation({
      source_name: 'Source',
      source_url: 'https://example.com',
      retrieved_at: new Date().toISOString(),
      data_hash: '',
      license: 'OGL',
      update_frequency: 'daily',
      original_format: 'CSV',
    });
    assert.equal(result.original_format, 'CSV');
  });
});

/* ------------------------------------------------------------------ */
/*  buildSuccess / buildError                                          */
/* ------------------------------------------------------------------ */

describe('buildSuccess', () => {
  it('returns a success response shape', () => {
    const ctx = makeContext();
    const resp = buildSuccess({ items: [1, 2, 3] }, ctx);

    assert.equal(resp.success, true);
    assert.deepEqual(resp.data, { items: [1, 2, 3] });
    assert.equal(resp.text, null);
    assert.equal(resp.error, null);
  });

  it('includes meta with requestId and timestamp', () => {
    const ctx = makeContext();
    const resp = buildSuccess('data', ctx);

    assert.equal(resp.meta.requestId, 'req-00000000-0000-0000-0000-000000000000');
    assert.ok(resp.meta.timestamp);
    assert.equal(resp.meta.version, '0.1.0');
  });

  it('includes quality meta', () => {
    const ctx = makeContext();
    const resp = buildSuccess('data', ctx);

    assert.ok(resp.quality);
    assert.equal(resp.quality!.confidence, 'high');
    assert.equal(resp.quality!.certainty_score, 0.923);
    assert.ok(resp.quality!.freshness_seconds >= 0);
  });

  it('does not fabricate a source retrieval timestamp for generic responses', () => {
    const resp = buildSuccess('data', makeContext());
    assert.equal(resp.citation?.retrieved_at, null);
    assert.equal(resp.citation?.citation_text?.includes('retrieved'), false);
  });

  it('uses an explicit no-publisher-declaration notice for generic responses', () => {
    const ctx = makeContext();
    const resp = buildSuccess('data', ctx);

    assert.ok(resp.citation);
    assert.equal(resp.citation!.source_name, UNKNOWN_SOURCE_CITATION.source_name);
    assert.equal(resp.citation!.license_basis, 'no-publisher-declaration');
    assert.match(resp.citation!.license, /No publisher license declaration/);
  });

  it('merges extra citation fields when provided', () => {
    const ctx = makeContext();
    const resp = buildSuccess('data', ctx, {
      source_name: 'Custom Source',
      source_url: 'https://custom.ca/data',
    });

    assert.equal(resp.citation!.source_name, 'Custom Source');
    assert.equal(resp.citation!.source_url, 'https://custom.ca/data');
  });

  it('applies token optimization when queryOptions provided', () => {
    const ctx = makeContext({
      queryOptions: { _fields: ['items'] },
    });
    const resp = buildSuccess({ items: [1, 2], extra: 'removed' }, ctx);

    assert.ok(resp.data);
    assert.deepEqual(resp.data, { items: [1, 2] });
  });

  it('uses metaOverrides when provided', () => {
    const ctx = makeContext({
      metaOverrides: { agent: 'custom-agent', cacheStatus: 'hit' },
    });
    const resp = buildSuccess('data', ctx);

    assert.equal(resp.meta.agent, 'custom-agent');
    assert.equal(resp.meta.cacheStatus, 'hit');
  });
});

describe('buildError', () => {
  it('returns error response shape', () => {
    const ctx = makeContext();
    const resp = buildError('NOT_FOUND', 'Resource not found', ctx);

    assert.equal(resp.success, false);
    assert.equal(resp.data, null);
    assert.equal(resp.error!.code, 'NOT_FOUND');
    assert.equal(resp.error!.message, 'Resource not found');
  });

  it('includes meta and quality', () => {
    const ctx = makeContext();
    const resp = buildError('RATE_LIMIT', 'Too many requests', ctx, 429);

    assert.ok(resp.meta);
    assert.ok(resp.quality);
  });

  it('includes a generic no-publisher-declaration citation', () => {
    const ctx = makeContext();
    const resp = buildError('ERROR', 'Something went wrong', ctx);

    assert.ok(resp.citation);
    assert.equal(resp.citation!.source_name, UNKNOWN_SOURCE_CITATION.source_name);
    assert.equal(resp.citation!.license_basis, 'no-publisher-declaration');
  });
});

/* ------------------------------------------------------------------ */
/*  getAllowedOrigin                                                    */
/* ------------------------------------------------------------------ */

describe('getAllowedOrigin', () => {
  it('allows configured development origins', () => {
    assert.equal(getAllowedOrigin('http://localhost:8082'), 'http://localhost:8082');
    assert.equal(getAllowedOrigin('http://localhost:4321'), 'http://localhost:4321');
    assert.equal(getAllowedOrigin('http://localhost:3001'), 'http://localhost:3001');
  });

  it('allows configured production origins', () => {
    assert.equal(getAllowedOrigin('https://maplespike.ca'), 'https://maplespike.ca');
    assert.equal(getAllowedOrigin('https://api.maplespike.ca'), 'https://api.maplespike.ca');
    assert.equal(getAllowedOrigin('https://mcp.maplespike.ca'), 'https://mcp.maplespike.ca');
  });

  it('rejects unknown origins with null', () => {
    assert.equal(getAllowedOrigin('https://evil.com'), 'null');
    assert.equal(getAllowedOrigin('http://localhost:9999'), 'null');
  });

  it('handles null requestOrigin', () => {
    assert.equal(getAllowedOrigin(null), 'null');
  });

  it('normalizes trailing slash', () => {
    assert.equal(
      getAllowedOrigin('https://maplespike.ca/'),
      'https://maplespike.ca',
    );
  });

  it('allows LAN origins', () => {
    assert.equal(getAllowedOrigin('http://10.1.1.120:4321'), 'http://10.1.1.120:4321');
    assert.equal(getAllowedOrigin('https://quill-api.lan'), 'https://quill-api.lan');
  });
});

/* ------------------------------------------------------------------ */
/*  jsonResponse                                                       */
/* ------------------------------------------------------------------ */

describe('jsonResponse', () => {
  it('returns a Response with Content-Type application/json', () => {
    const ctx = makeContext();
    const body = buildSuccess('ok', ctx);
    const resp = jsonResponse(body);

    assert.equal(resp.status, 200);
    assert.equal(resp.headers.get('Content-Type'), 'application/json');
  });

  it('includes cache-control headers', () => {
    const ctx = makeContext();
    const body = buildSuccess('ok', ctx);
    const resp = jsonResponse(body);

    const cc = resp.headers.get('Cache-Control');
    assert.ok(cc);
    assert.ok(cc.includes('no-cache'));
  });

  it('includes X-MapleSpike-Version header', () => {
    const ctx = makeContext();
    const resp = jsonResponse(buildSuccess('ok', ctx));

    assert.equal(resp.headers.get('X-MapleSpike-Version'), '0.1.0');
  });

  it('includes X-MapleSpike-Trace-Id header', () => {
    const ctx = makeContext();
    const resp = jsonResponse(buildSuccess('ok', ctx));

    const traceId = resp.headers.get('X-MapleSpike-Trace-Id');
    assert.ok(traceId);
    assert.ok(traceId!.length > 0);
  });

  it('uses extra trace ID if provided', () => {
    const ctx = makeContext();
    const customTrace = 'custom-trace-123';
    const resp = jsonResponse(buildSuccess('ok', ctx), 200, {
      'X-MapleSpike-Trace-Id': customTrace,
    });

    assert.equal(resp.headers.get('X-MapleSpike-Trace-Id'), customTrace);
  });

  it('sets custom status code', () => {
    const ctx = makeContext();
    const resp = jsonResponse(buildError('NOT_FOUND', 'Not found', ctx), 404);
    assert.equal(resp.status, 404);
  });

  it('includes CORS Access-Control-Allow-Origin header', () => {
    const ctx = makeContext();
    const resp = jsonResponse(buildSuccess('ok', ctx), 200, {}, 'http://localhost:8082');

    assert.equal(resp.headers.get('Access-Control-Allow-Origin'), 'http://localhost:8082');
  });

  it('includes OWASP security headers', () => {
    const ctx = makeContext();
    const resp = jsonResponse(buildSuccess('ok', ctx));

    assert.equal(resp.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(resp.headers.get('X-Frame-Options'), 'DENY');
    assert.ok(resp.headers.get('Referrer-Policy'));
    assert.ok(resp.headers.get('Permissions-Policy'));
  });

  it('body is serialized JSON', async () => {
    const ctx = makeContext();
    const resp = jsonResponse(buildSuccess({ key: 'value' }, ctx));

    const body = await resp.json();
    assert.equal(body.success, true);
    assert.equal(body.data.key, 'value');
  });
});

/* ------------------------------------------------------------------ */
/*  addRateLimitHeaders                                                */
/* ------------------------------------------------------------------ */

describe('addRateLimitHeaders', () => {
  it('adds X-RateLimit-Remaining header', () => {
    const ctx = makeContext();
    const original = jsonResponse(buildSuccess('ok', ctx));
    const modified = addRateLimitHeaders(original, { remaining: 42, resetTime: 1700000000000 });

    assert.equal(modified.headers.get('X-RateLimit-Remaining'), '42');
  });

  it('adds X-RateLimit-Reset header as seconds', () => {
    const ctx = makeContext();
    const original = jsonResponse(buildSuccess('ok', ctx));
    const resetMs = 1700000000000;
    const modified = addRateLimitHeaders(original, { remaining: 10, resetTime: resetMs });

    assert.equal(modified.headers.get('X-RateLimit-Reset'), String(Math.floor(resetMs / 1000)));
  });

  it('clamps remaining to zero', () => {
    const ctx = makeContext();
    const original = jsonResponse(buildSuccess('ok', ctx));
    const modified = addRateLimitHeaders(original, { remaining: -5, resetTime: 0 });

    assert.equal(modified.headers.get('X-RateLimit-Remaining'), '0');
  });

  it('preserves original status and body', async () => {
    const ctx = makeContext();
    const original = jsonResponse(buildSuccess('test-data', ctx), 201);
    const modified = addRateLimitHeaders(original, { remaining: 99, resetTime: 9999999999000 });

    assert.equal(modified.status, 201);
    const body = await modified.json();
    assert.equal(body.data, 'test-data');
  });
});

/* ------------------------------------------------------------------ */
/*  corsPreflight                                                      */
/* ------------------------------------------------------------------ */

describe('corsPreflight', () => {
  it('returns 204 response', () => {
    const resp = corsPreflight();
    assert.equal(resp.status, 204);
  });

  it('includes Access-Control-Allow-Origin', () => {
    const resp = corsPreflight('https://quill-api.lan');
    assert.equal(resp.headers.get('Access-Control-Allow-Origin'), 'https://quill-api.lan');
  });

  it('includes Access-Control-Max-Age of 86400', () => {
    const resp = corsPreflight();
    assert.equal(resp.headers.get('Access-Control-Max-Age'), '86400');
  });

  it('includes allowed methods and headers', () => {
    const resp = corsPreflight();

    assert.ok(resp.headers.get('Access-Control-Allow-Methods')!.includes('GET'));
    assert.ok(resp.headers.get('Access-Control-Allow-Headers')!.includes('Authorization'));
    assert.ok(resp.headers.get('Access-Control-Expose-Headers')!.includes('X-RateLimit'));
  });

  it('rejects unknown origin', () => {
    const resp = corsPreflight('https://evil.com');
    assert.equal(resp.headers.get('Access-Control-Allow-Origin'), 'null');
  });

  it('includes OWASP security headers', () => {
    const resp = corsPreflight();
    assert.ok(resp.headers.get('X-Content-Type-Options'));
  });
});

/* ------------------------------------------------------------------ */
/*  calcRateLimitReset                                                 */
/* ------------------------------------------------------------------ */

describe('calcRateLimitReset', () => {
  it('returns a future timestamp for daily period', () => {
    const now = Math.floor(Date.now() / 1000);
    const reset = calcRateLimitReset('daily');
    assert.ok(reset > now, `Reset ${reset} should be after now ${now}`);
  });

  it('returns a future timestamp for monthly period', () => {
    const now = Math.floor(Date.now() / 1000);
    const reset = calcRateLimitReset('monthly');
    assert.ok(reset > now, `Reset ${reset} should be after now ${now}`);
  });

  it('daily reset is within 48 hours', () => {
    const now = Math.floor(Date.now() / 1000);
    const reset = calcRateLimitReset('daily');
    const diffHours = (reset - now) / 3600;
    assert.ok(diffHours > 0 && diffHours <= 48, `Daily reset ${diffHours}h should be ≤ 48h`);
  });

  it('monthly reset is within 32 days', () => {
    const now = Math.floor(Date.now() / 1000);
    const reset = calcRateLimitReset('monthly');
    const diffDays = (reset - now) / 86400;
    assert.ok(diffDays > 0 && diffDays <= 32, `Monthly reset ${diffDays}d should be ≤ 32d`);
  });
});
