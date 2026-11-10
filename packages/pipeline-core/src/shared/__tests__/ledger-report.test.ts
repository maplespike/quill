// SPDX-License-Identifier: AGPL-3.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mintInternalToken, reportIngest } from '../ledger-report.js';

const SECRET = 'a'.repeat(48);

test('mintInternalToken produces an HS256 token with the API contract claims', () => {
  const token = mintInternalToken(SECRET, 'ingest');
  const [header, payload, sig] = token.split('.');
  assert.equal(token.split('.').length, 3);
  assert.equal(JSON.parse(Buffer.from(header!, 'base64').toString()).alg, 'HS256');
  const claims = JSON.parse(Buffer.from(payload!, 'base64').toString());
  assert.equal(claims.iss, 'quill-services');
  assert.equal(claims.aud, 'quill-internal');
  assert.equal(claims.tier, 'internal');
  assert.equal(claims.sub, 'svc:ingest');
  assert.ok(claims.exp > claims.iat);
  assert.ok(sig && sig.length > 20);
});

test('mintInternalToken refuses a short secret', () => {
  assert.throws(() => mintInternalToken('too-short', 'ingest'), /at least 32/);
});

test('reportIngest posts the report with the token', async () => {
  const seen: { url: string; init: RequestInit }[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    return { ok: true, status: 200 } as Response;
  }) as unknown as typeof fetch;
  const ok = await reportIngest(
    { module: 'committees', status: 'success', records: 3 },
    { INTERNAL_JWT_SECRET: SECRET, QUILL_API_URL: 'http://quill-api:8080/' } as NodeJS.ProcessEnv,
    fakeFetch,
  );
  assert.equal(ok, true);
  assert.equal(seen.length, 1);
  assert.equal(seen[0]!.url, 'http://quill-api:8080/v1/internal/ingest-report');
  const headers = seen[0]!.init.headers as Record<string, string>;
  assert.ok(headers['X-Internal-Token']!.split('.').length === 3);
  const body = JSON.parse(String(seen[0]!.init.body));
  assert.equal(body.module, 'committees');
  assert.equal(body.records, 3);
  assert.ok(body.at);
});

test('reportIngest is silent and non-throwing when unconfigured or failing', async () => {
  assert.equal(await reportIngest({ module: 'x', status: 'success' }, {} as NodeJS.ProcessEnv), false);
  assert.equal(
    await reportIngest({ module: 'x', status: 'success' }, { INTERNAL_JWT_SECRET: SECRET, QUILL_API_URL: 'http://a' } as NodeJS.ProcessEnv, (async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch),
    false,
  );
  const rejected = (async () => ({ ok: false, status: 403 }) as Response) as unknown as typeof fetch;
  assert.equal(await reportIngest({ module: 'x', status: 'success' }, { INTERNAL_JWT_SECRET: SECRET, QUILL_API_URL: 'http://a' } as NodeJS.ProcessEnv, rejected), false);
});
