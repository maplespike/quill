import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAllModules } from '@maplespike/pipeline-core';
import { PIPELINE_CONFIG } from '../../pipeline-core/src/cli/run-pipeline.js';
import { ApiMetrics, isKnownPipeline, normalizeApiMethod, normalizeApiStatus, registerApiMetricRoute } from './metrics.js';
import { getMetricsRoute, ROUTES } from './index.js';

test('API metrics expose cumulative duration buckets and finite HTTP labels', () => {
  const route = registerApiMetricRoute('/v1/health');
  const metrics = new ApiMetrics();
  metrics.record(route, 'GET', '2xx', 0.04);
  metrics.record(route, 'GET', '2xx', 0.2);

  const output = metrics.render();
  assert.match(output, /quill_api_http_requests_total\{route="\/v1\/health",method="GET",status_class="2xx"\} 2/);
  assert.match(output, /le="0.05"\} 1/);
  assert.match(output, /le="0.25"\} 2/);
  assert.match(output, /le="\+Inf"\} 2/);
  assert.match(output, /_count\{.*\} 2/);
  assert.doesNotMatch(output, /api_key|tenant_id|request_id|query|Bearer|secret|sensitive-value/);
});

test('ingestion metrics accept every canonical alias and registry-backed module label', () => {
  const modules = new Set(getAllModules().map(({ name }) => name));
  for (const alias of Object.keys(PIPELINE_CONFIG)) {
    assert.equal(isKnownPipeline(alias, modules), true, `known alias ${alias}`);
  }
  assert.equal(isKnownPipeline('ngo-rss', modules), true);
  assert.equal(isKnownPipeline('realtime', modules), true);
  assert.equal(isKnownPipeline('committees', modules), true);
  assert.equal(isKnownPipeline('all', modules), true);
  assert.equal(isKnownPipeline('all:committees', modules), true);
  assert.equal(isKnownPipeline('all:customer-controlled', modules), false);
  assert.equal(isKnownPipeline('customer-controlled', modules), false);
});

test('API method and status normalization keep metrics labels bounded', () => {
  assert.equal(normalizeApiMethod('GET'), 'GET');
  assert.equal(normalizeApiMethod('CONNECT'), 'OTHER');
  assert.equal(normalizeApiStatus(201), '2xx');
  assert.equal(normalizeApiStatus(429), '4xx');
  assert.equal(normalizeApiStatus(503), '5xx');
  assert.equal(normalizeApiStatus(304), 'other');
  assert.equal(normalizeApiStatus(Number.NaN), 'other');
  assert.equal(normalizeApiStatus(99), 'other');
});

test('API route labels use registered templates and never include path parameters', () => {
  assert.ok(ROUTES.length > 100, 'the complete API route table must be available to metrics');
  for (const route of ROUTES) {
    assert.notEqual(getMetricsRoute(samplePath(route.pattern), route.method), 'unmatched', route.pattern.source);
  }

  const verifyRoute = getMetricsRoute('/v1/verify/secret-customer-token', 'GET');
  const entityRoute = getMetricsRoute('/v1/entities/private-id', 'GET');
  assert.equal(verifyRoute, '/v1/verify/:token');
  assert.equal(entityRoute, '/v1/entities/:id');
  assert.equal(getMetricsRoute('/v1', 'GET'), '/v1');
  assert.equal(getMetricsRoute('/v1/auth/oauth/github/callback', 'GET'), '/v1/auth/oauth/:provider/callback');
  assert.equal(getMetricsRoute('/v1/not-a-route/private-id', 'GET'), 'unmatched');

  const metrics = new ApiMetrics();
  metrics.record(verifyRoute, 'GET', '2xx', 0.1);
  metrics.record(entityRoute, 'GET', '2xx', 0.2);
  assert.doesNotMatch(metrics.render(), /secret-customer-token|private-id/);
});

function samplePath(pattern: RegExp): string {
  return pattern.source
    .replace(/^\^/, '')
    .replace(/\$$/, '')
    .replaceAll('\\/', '/')
    .replace(/\\\./g, '.')
    .replace(/\(\[\^\/\]\+\)/g, 'sample-value')
    .replace(/\/\?$/, '');
}

test('API duration metrics normalize invalid durations and unregistered routes', () => {
  const metrics = new ApiMetrics();
  metrics.record('/v1/private-customer-id', 'GET', '2xx', Number.NaN);
  metrics.record('/v1/private-customer-id', 'GET', '2xx', Number.POSITIVE_INFINITY);
  const output = metrics.render();
  assert.match(output, /route="unmatched"/);
  assert.doesNotMatch(output, /NaN|Infinity|private-customer-id/);
});

test('API active tenants are distinct, bounded, and expire from the window', () => {
  let now = 1_000_000;
  const metrics = new ApiMetrics({ now: () => now, windowMs: 1000, maxTenants: 2 });
  metrics.recordTenant('tenant-alpha', 'pro');
  metrics.recordTenant('tenant-alpha', 'pro');
  metrics.recordTenant('tenant-beta', 'free');

  let output = metrics.render();
  assert.match(output, /quill_api_active_tenants 2/);
  assert.match(output, /quill_api_active_tenants_by_tier\{tier="free"\} 1/);
  assert.match(output, /quill_api_active_tenants_by_tier\{tier="pro"\} 1/);

  // The bounded set evicts the oldest identity rather than growing without limit.
  metrics.recordTenant('tenant-gamma', 'business');
  output = metrics.render();
  assert.match(output, /quill_api_active_tenants 2/);
  assert.doesNotMatch(output, /quill_api_active_tenants_by_tier\{tier="pro"\} /);

  now += 1001;
  assert.match(metrics.render(), /quill_api_active_tenants 0/);
  assert.doesNotMatch(metrics.render(), /tenant-alpha|tenant-beta|tenant-gamma/);
});

test('API active tenant tiers are normalized and never expose tenant IDs', () => {
  const metrics = new ApiMetrics();
  metrics.recordTenant('', 'pro');
  metrics.recordTenant('tenant-secret-id', 'customer-controlled-label');
  const output = metrics.render();
  assert.match(output, /quill_api_active_tenants 1/);
  assert.match(output, /quill_api_active_tenants_by_tier\{tier="other"\} 1/);
  assert.doesNotMatch(output, /tenant-secret-id|customer-controlled-label/);
});
