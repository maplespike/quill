/**
 * API user journey — the path a real customer takes, end to end (#api-tests).
 *
 * The other api-server suites test routes in isolation (a route returns a
 * plausible status). This one walks the actual funnel against ONE shared
 * storage, so state must survive between steps:
 *
 *   register -> receive an API key -> authenticate with it -> reach a free
 *   endpoint -> be blocked (402) at the paid boundary with an explanatory
 *   body -> be rejected (401) with a bad or missing key -> and prove that two
 *   tenants never see each other's identity.
 *
 * If this suite fails, the product does not work for a new customer — even if
 * every individual route "returns 200" somewhere else in the repo.
 */

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';

import { handleRequest } from '../index.js';
import { NodeSqliteStorage, NodeSqliteCache } from '../node-sqlite-storage.js';

// One storage for the whole journey — the same way dev-server/prod wire it.
const db = new NodeSqliteStorage(':memory:');
const cache = new NodeSqliteCache();

const env: Record<string, string | undefined> = {
  ENVIRONMENT: 'test',
  QUILL_VERSION: 'test',
  QUILL_PII_HASH_SECRET: '0'.repeat(64),
  JWT_SECRET: 'a'.repeat(64),
  JWT_SECRET_IS_SIMPLE: 'true',
};

const call = (path: string, init?: RequestInit) =>
  handleRequest(new Request(`http://test.local${path}`, init), env, db, cache);

const json = async (res: Response) => {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { __raw: text } as Record<string, unknown>;
  }
};

interface Tenant {
  id: string;
  key: string;
}

async function register(name: string, email: string): Promise<Tenant> {
  const res = await call('/v1/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email }),
  });
  const body = await json(res);
  assert.ok(
    res.status === 200 || res.status === 201,
    `register failed (HTTP ${res.status}): ${JSON.stringify(body).slice(0, 300)}`,
  );
  const data = body['data'] as
    | { tenant?: { id?: string; tier?: string }; apiKey?: { key?: string } }
    | undefined;
  assert.ok(data?.tenant?.id, 'register response must carry data.tenant.id');
  assert.ok(data?.apiKey?.key, 'register response must carry an API key');
  assert.match(String(data!.apiKey!.key), /^quill_/, 'API keys are prefixed quill_');
  assert.equal(data!.tenant!.tier, 'free', 'registration starts a tenant on the free tier');
  return { id: String(data!.tenant!.id), key: String(data!.apiKey!.key) };
}

let tenantA: Tenant;
let tenantB: Tenant;
let keyVault: string;

before(async () => {
  tenantA = await register('Journey A', 'journey-a@example.com');
  tenantB = await register('Journey B', 'journey-b@example.com');
});

after(() => {
  // NodeSqliteStorage keeps a real handle; close it so the test process exits.
  (db as unknown as { close?: () => void }).close?.();
});

describe('API user journey', () => {
  test('1. registration issues a usable key for a brand-new tenant', () => {
    assert.match(tenantA.key, /^quill_[A-Za-z0-9]+/);
    assert.notEqual(tenantA.id, tenantB.id, 'each registration gets its own tenant');
    assert.notEqual(tenantA.key, tenantB.key, 'each registration gets its own key');
  });

  test('2. the issued key authenticates: gated routes answer 402, never 401', async () => {
    // NOTE (product gap, filed): the free tier has NO tenant-scoped read
    // endpoint, so "authenticated" can only be proven by the 401-vs-402
    // distinction — a valid free key reaches the tier gate, an invalid key
    // does not. See the free-tier self-service issue.
    const res = await call('/v1/me', { headers: { Authorization: `Bearer ${tenantA.key}` } });
    assert.equal(res.status, 402, 'a valid free key must pass auth and hit the tier gate');
    const body = await json(res);
    const err = (body['error'] ?? {}) as Record<string, unknown>;
    assert.equal(err['code'], 'UPGRADE_REQUIRED', 'the tier gate must name its code');
    assert.match(String(err['message'] ?? ''), /plan|tier|free/i, 'EN message must explain the boundary');
    assert.ok(
      String(err['message_fr'] ?? '').length > 0 && !/inconnue/i.test(String(err['message_fr'])),
      `FR message must be real, got: ${String(err['message_fr'])}`,
    );
  });

  test('3. tenant isolation: no response addressed to B ever carries A', async () => {
    // Both tenants take the same gated path; neither response may contain the
    // other tenant's id or key material.
    const resB = await call('/v1/me', { headers: { Authorization: `Bearer ${tenantB.key}` } });
    const flatB = JSON.stringify(await json(resB));
    assert.ok(!flatB.includes(tenantA.id), 'key B must never leak tenant A identity');
    assert.ok(!flatB.includes(tenantA.key), 'key B must never leak tenant A key material');
    assert.ok(!flatB.includes(tenantB.key), 'responses must not echo raw key material back');
  });

  test('4. a free-tier endpoint is reachable with the key', async () => {
    const res = await call('/v1/llms.txt', { headers: { Authorization: `Bearer ${tenantA.key}` } });
    assert.equal(res.status, 200, 'llms.txt must stay free for a signed-up tenant');
  });

  test('5. the paid boundary answers 402 with an explanatory body', async () => {
    const res = await call('/v1/gov/search?q=housing', { headers: { Authorization: `Bearer ${tenantA.key}` } });
    assert.equal(res.status, 402, 'a free tenant calling a data route must get 402');
    const body = await json(res);
    const flat = JSON.stringify(body);
    assert.ok(body['__raw'] === undefined, `402 body must be JSON, got: ${flat.slice(0, 120)}`);
    assert.ok(
      /upgrade|tier|plan|limit|quota/i.test(flat),
      `402 body must explain the boundary (upgrade/tier/plan), got: ${flat.slice(0, 300)}`,
    );
  });

  test('6. a bad key is rejected with 401 (never silently accepted)', async () => {
    const res = await call('/v1/me', { headers: { Authorization: 'Bearer quill_not_a_real_key' } });
    assert.equal(res.status, 401);
  });

  test('7. a missing key is rejected with 401', async () => {
    const res = await call('/v1/me');
    assert.equal(res.status, 401);
  });

  test('8. the key list shows the tenant its own key (masked, never the raw secret)', async () => {
    const res = await call('/v1/keys', { headers: { Authorization: `Bearer ${tenantA.key}` } });
    assert.ok(res.status === 200 || res.status === 402, `unexpected /v1/keys status ${res.status}`);
    if (res.status !== 200) return; // tier-gated presentation is acceptable; leakage is not
    const flat = JSON.stringify(await json(res));
    keyVault = flat;
    assert.ok(
      !flat.includes(tenantA.key),
      'the key list must never echo the raw API key back',
    );
    assert.ok(!flat.includes(tenantB.key), 'the key list must not contain another tenant key');
  });

  // ── /v1/auth/me identity resolution (regression: the route ignored keys) ──
  // /v1/auth/* is auth-exempt so login and OAuth callbacks stay reachable. That
  // exemption also silenced key resolution on /v1/auth/me, so a caller holding a
  // valid key was answered as the anonymous tenant with no keys of its own.

  test('9. /v1/auth/me resolves the caller own key (never the anon tenant)', async () => {
    const res = await call('/v1/auth/me', { headers: { Authorization: 'Bearer ' + tenantA.key } });
    assert.equal(res.status, 200, 'a valid key must be answered, not rejected');
    const body = await json(res);
    const data = (body['data'] ?? {}) as Record<string, unknown>;
    const tenant = (data['tenant'] ?? {}) as Record<string, unknown>;
    assert.equal(tenant['id'], tenantA.id, 'the profile must belong to the key tenant');
    assert.notEqual(tenant['id'], 'anon', 'a presented key must never resolve to anon');
    const flat = JSON.stringify(body);
    assert.ok(!flat.includes(tenantA.key), 'the profile must never echo the raw key');
    assert.ok(!flat.includes(tenantB.key), 'the profile must never mention another tenant');
  });

  test('10. /v1/auth/me stays reachable with no credentials (anon tenant)', async () => {
    const res = await call('/v1/auth/me');
    assert.equal(res.status, 200, 'login/anon flows must not require a key');
    const body = await json(res);
    const data = (body['data'] ?? {}) as Record<string, unknown>;
    const tenant = (data['tenant'] ?? {}) as Record<string, unknown>;
    assert.equal(tenant['id'], 'anon', 'no credentials means the anon tenant');
  });

  test('11. /v1/auth/me rejects a bogus key with 401 instead of anon-shaped 200', async () => {
    const res = await call('/v1/auth/me', { headers: { Authorization: 'Bearer quill_not_a_real_key' } });
    assert.equal(res.status, 401, 'a presented but invalid key must fail closed');
  });

  test('12. an anonymous call to a paid data route gets 401, not a plan upsell', async () => {
    const res = await call('/v1/gov/search?q=housing');
    assert.equal(res.status, 401, 'anonymous callers must be told to authenticate, not to upgrade');
  });
});
