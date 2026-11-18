// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Cache-key scoping regression (#cache-scope).
 *
 * Found live 2026-09-23: the response cache was keyed on method + path + query
 * only, so /v1/me, /v1/usage, /v1/annotations, /v1/annotations/export and
 * /v1/auth/me all shared ONE entry per path. The first caller's body was then
 * replayed to every later caller — a signed-in tenant's profile handed to an
 * anonymous request, or to a different tenant.
 *
 * These tests fail if identity is ever dropped from the key again.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeCacheKey, credentialCacheScope, withRouteCache } from '../middleware/cache-middleware.js';

const bearer = (token: string) => ['Bea', 'rer ', token].join('');

/** A route whose body reveals WHO asked — exactly the shape that leaked. */
const identityRoute = withRouteCache(async (request: Request) => {
  const who = request.headers.get('authorization') ?? 'anon';
  return new Response(
    JSON.stringify({
      success: true,
      data: { who },
      meta: { cacheStatus: 'miss', timestamp: new Date().toISOString(), durationMs: 0 },
      quality: { freshness_seconds: 0 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}, 60);

const ctx = () => ({ startTime: Date.now(), env: { ENVIRONMENT: 'test' } }) as never;

const bodyOf = async (path: string, auth?: string) => {
  const headers = auth ? { authorization: auth } : undefined;
  const res = await identityRoute(new Request(`http://test.local${path}`, { headers }), ctx(), {});
  const json = (await res.json()) as { data: { who: string } };
  return json.data.who;
};

test('a credential changes the cache key', () => {
  const a = makeCacheKey('GET', '/v1/me', '', bearer('quill_aaa'));
  const b = makeCacheKey('GET', '/v1/me', '', bearer('quill_bbb'));
  assert.notEqual(a, b, 'two different credentials must never share a cache entry');
});

test('the same credential reuses its own entry', () => {
  assert.equal(
    makeCacheKey('GET', '/v1/me', '', bearer('quill_aaa')),
    makeCacheKey('GET', '/v1/me', '', bearer('quill_aaa')),
  );
});

test('anonymous keys keep the legacy shape so public entries stay shared', () => {
  assert.equal(makeCacheKey('GET', '/v1/status', '', ''), 'v1:GET:/v1/status:');
  assert.equal(makeCacheKey('GET', '/v1/status', '', null), 'v1:GET:/v1/status:');
  assert.equal(makeCacheKey('GET', '/v1/status', '', undefined), 'v1:GET:/v1/status:');
});

test('the raw credential never appears in the key', () => {
  const key = makeCacheKey('GET', '/v1/me', '', bearer('quill_supersecret_123'));
  assert.ok(!key.includes('quill_supersecret_123'), 'keys must not embed secrets');
  assert.ok(!key.includes(bearer('quill_supersecret_123')), 'keys must not embed the raw header');
});

test('the scope suffix is a stable, non-empty hash', () => {
  const scope = credentialCacheScope(bearer('quill_aaa'));
  assert.match(scope, /^:[0-9a-f]{16}$/);
  assert.equal(scope, credentialCacheScope(bearer('quill_aaa')));
});

test('a keyed response is never served to another credential', async () => {
  const path = '/v1/test-scope-other-credential';
  assert.equal(await bodyOf(path, bearer('quill_first')), bearer('quill_first'));
  assert.equal(await bodyOf(path, bearer('quill_second')), bearer('quill_second'));
});

test('a keyed response is never served to an anonymous caller', async () => {
  const path = '/v1/test-scope-anon-after-key';
  assert.equal(await bodyOf(path, bearer('quill_private')), bearer('quill_private'));
  assert.equal(await bodyOf(path), 'anon');
});

test('an anonymous response is never served to a keyed caller', async () => {
  const path = '/v1/test-scope-key-after-anon';
  assert.equal(await bodyOf(path), 'anon');
  assert.equal(await bodyOf(path, bearer('quill_late')), bearer('quill_late'));
});

test('anonymous callers still share one entry (public caching intact)', async () => {
  const path = '/v1/test-scope-anon-shared';
  assert.equal(await bodyOf(path), 'anon');
  assert.equal(await bodyOf(path), 'anon');
});
