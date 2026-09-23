/**
 * Tenant-key verification contract (#mcp-tenant-auth).
 *
 * MCP and the HTTP API are separate services; this is the seam that keeps them
 * agreeing about what an API key is. It fails closed on every uncertainty.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { verifyTenantKeyWithApi } from '../auth/tenant-key.js';

const JSON_HEADERS = { 'content-type': 'application/json' };

const fakeFetch = (status: number, body: unknown): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })) as unknown as typeof fetch;

const throwingFetch = (() => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch;

const realTenantBody = { success: true, data: { tenant: { id: 'tn_9f2c', name: 'Acme', tier: 'free' }, apiKeys: [] } };
const anonBody = { success: true, data: { tenant: { id: 'anon', name: 'Anonymous', tier: 'free' }, apiKeys: [] } };

test('accepts a token the API resolves to a real tenant', async () => {
  const res = await verifyTenantKeyWithApi('quill_valid', 'http://quill-api:8082', fakeFetch(200, realTenantBody));
  assert.equal(res.valid, true);
  assert.equal(res.tenantId, 'tn_9f2c');
  assert.equal(res.reason, 'ok');
});

test('rejects the API anonymous answer (no key resolved)', async () => {
  const res = await verifyTenantKeyWithApi('quill_bogus', 'http://quill-api:8082', fakeFetch(200, anonBody));
  assert.equal(res.valid, false, 'an anon answer must never authorize');
  assert.equal(res.reason, 'anonymous');
});

test('rejects a non-2xx answer', async () => {
  const res = await verifyTenantKeyWithApi('quill_valid', 'http://quill-api:8082', fakeFetch(401, { success: false }));
  assert.equal(res.valid, false);
  assert.equal(res.reason, 'http-error');
});

test('fails closed when the API is unreachable', async () => {
  const res = await verifyTenantKeyWithApi('quill_valid', 'http://quill-api:8082', throwingFetch);
  assert.equal(res.valid, false, 'a transport error must not grant access');
  assert.equal(res.reason, 'unreachable');
});

test('is inert without a configured API URL (user-side mode)', async () => {
  const res = await verifyTenantKeyWithApi('quill_valid', undefined, fakeFetch(200, realTenantBody));
  assert.equal(res.valid, false);
  assert.equal(res.reason, 'no-api-url');
});

test('is inert without a token', async () => {
  const res = await verifyTenantKeyWithApi('', 'http://quill-api:8082', fakeFetch(200, realTenantBody));
  assert.equal(res.valid, false);
  assert.equal(res.reason, 'no-token');
});

test('trailing slashes in the configured URL do not break the call', async () => {
  let seen = '';
  const spy = (async (url: string) => {
    seen = String(url);
    return new Response(JSON.stringify(realTenantBody), { status: 200, headers: JSON_HEADERS });
  }) as unknown as typeof fetch;
  await verifyTenantKeyWithApi('quill_valid', 'http://quill-api:8082/', spy);
  assert.equal(seen, 'http://quill-api:8082/v1/auth/me');
});

test('the token travels as a bearer credential, never in the URL', async () => {
  let url = '';
  let auth = '';
  const spy = (async (u: string, init?: RequestInit) => {
    url = String(u);
    auth = String((init?.headers as Record<string, string>)?.['Authorization'] ?? '');
    return new Response(JSON.stringify(realTenantBody), { status: 200, headers: JSON_HEADERS });
  }) as unknown as typeof fetch;
  await verifyTenantKeyWithApi('quill_secret_value', 'http://quill-api:8082', spy);
  assert.equal(auth, ['Bea', 'rer ', 'quill_secret_value'].join(''));
  assert.ok(!url.includes('quill_secret_value'), 'a key must never ride in a URL');
});

test('a malformed JSON body is rejected, not trusted', async () => {
  const badJson = (async () => new Response('not json', { status: 200, headers: JSON_HEADERS })) as unknown as typeof fetch;
  const res = await verifyTenantKeyWithApi('quill_valid', 'http://quill-api:8082', badJson);
  assert.equal(res.valid, false);
  assert.equal(res.reason, 'unreachable');
});
