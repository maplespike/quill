/**
 * API user journey — the path a real customer takes, end to end (#api-tests).
 *
 * The other api-server suites test routes in isolation (a route returns a
 * plausible status). This one walks the actual funnel against ONE shared
 * storage, so state must survive between steps:
 *
 *   register -> receive an API key -> authenticate with it -> read your OWN
 *   usage (200, self-scoped) -> be blocked (402) at the paid boundary with an
 *   explanatory bilingual body -> be rejected (401) with a bad or missing key
 *   -> and prove that two tenants never see each other's identity.
 *
 * If this suite fails, the product does not work for a new customer — even if
 * every individual route "returns 200" somewhere else in the repo.
 *
 * Contract note (#891, gate B2-FREEUSAGE): step 2 used to prove authentication
 * only through the 401-vs-402 distinction, because the Free tier had no
 * tenant-scoped read at all. /v1/usage is now self-scoped for every tier, so
 * step 2 asserts the stronger contract — a 200 carrying THIS tenant's own
 * numbers — and the bilingual 402 assertions moved to step 5, where the 402
 * still lives.
 */

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';

import { handleRequest } from '../index.js';
import { NodeSqliteStorage, NodeSqliteCache } from '../node-sqlite-storage.js';
import { TIER_LIMITS } from '../types.js';

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

/** Bearer header for a tenant key. */
const auth = (key: string) => ({ Authorization: `Bearer ${key}` });

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

  test('2. the issued key authenticates: it reads its OWN usage (200, self-scoped)', async () => {
    // #891 / gate B2-FREEUSAGE. The Free tier now has a tenant-scoped read, so
    // "authenticated" is proven by a 200 carrying this tenant's own numbers —
    // no longer by the 401-vs-402 distinction alone.
    const res = await call('/v1/usage', { headers: auth(tenantA.key) });
    assert.equal(res.status, 200, 'a valid free key must be able to read its own usage');

    const body = await json(res);
    assert.equal(
      body['success'],
      true,
      `usage read must succeed, got: ${JSON.stringify(body).slice(0, 200)}`,
    );

    const data = (body['data'] ?? {}) as Record<string, unknown>;
    assert.equal(data['scope'], 'self', 'the usage read must declare its scope');

    const tenant = (data['tenant'] ?? {}) as Record<string, unknown>;
    assert.equal(tenant['id'], tenantA.id, 'the read must be scoped to the calling key');
    assert.equal(tenant['tier'], 'free', 'the read must state the calling tenant tier');

    const usage = (data['usage'] ?? {}) as Record<string, Record<string, number>>;
    assert.equal(usage['daily']?.['limit'], TIER_LIMITS.free.daily, 'free daily limit must be reported');
    assert.equal(usage['monthly']?.['limit'], TIER_LIMITS.free.monthly, 'free monthly limit must be reported');
    assert.equal(typeof usage['daily']?.['calls'], 'number', 'daily call count must be a number');
    assert.equal(typeof usage['monthly']?.['calls'], 'number', 'monthly call count must be a number');

    const flat = JSON.stringify(body);
    assert.ok(!flat.includes(tenantB.id), 'A must never receive tenant B identity');
    assert.ok(!flat.includes(tenantB.key), 'A must never receive tenant B key material');
    assert.ok(!flat.includes(tenantA.key), 'responses must not echo raw key material back');
  });

  test('3. tenant isolation: no response addressed to B ever carries A', async () => {
    // Both tenants read the same self-scoped surface; neither response may
    // contain the other tenant's id or key material.
    const resB = await call('/v1/usage', { headers: auth(tenantB.key) });
    assert.equal(resB.status, 200, 'tenant B must be able to read its own usage');
    const bodyB = await json(resB);
    const flatB = JSON.stringify(bodyB);
    const dataB = (bodyB['data'] ?? {}) as Record<string, unknown>;
    assert.equal(dataB['scope'], 'self', 'B response must be self-scoped');
    assert.equal(
      (dataB['tenant'] as Record<string, unknown>)['id'],
      tenantB.id,
      'B must read B, never A',
    );
    assert.ok(flatB.includes(tenantB.id), 'key B must receive its own identity');
    assert.ok(!flatB.includes(tenantA.id), 'key B must never leak tenant A identity');
    assert.ok(!flatB.includes(tenantA.key), 'key B must never leak tenant A key material');
    assert.ok(!flatB.includes(tenantB.key), 'responses must not echo raw key material back');

    // The gated path stays gated — and equally isolated.
    const resMe = await call('/v1/me', { headers: auth(tenantB.key) });
    assert.equal(resMe.status, 402, '/v1/me stays Pro+ (the paid boundary)');
    const flatMe = JSON.stringify(await json(resMe));
    assert.ok(!flatMe.includes(tenantA.id), 'the 402 body must not leak tenant A identity');
    assert.ok(!flatMe.includes(tenantA.key), 'the 402 body must not leak tenant A key material');
  });

  test('4. a free-tier endpoint is reachable with the key', async () => {
    const res = await call('/v1/llms.txt', { headers: { Authorization: `Bearer ${tenantA.key}` } });
    assert.equal(res.status, 200, 'llms.txt must stay free for a signed-up tenant');
  });

  test('5. the paid boundary answers 402 with an explanatory bilingual body', async () => {
    // /v1/me is Pro+ (not on the Free whitelist) and — unlike the auth-exempt
    // public routes — it authenticates the caller first, so this 402 body is
    // addressed to tenant A and must carry A's own usage summary.
    const res = await call('/v1/me', { headers: auth(tenantA.key) });
    assert.equal(res.status, 402, 'a free tenant calling a Pro+ route must get 402');
    const body = await json(res);
    const flat = JSON.stringify(body);
    assert.ok(body['__raw'] === undefined, `402 body must be JSON, got: ${flat.slice(0, 120)}`);
    assert.ok(
      /upgrade|tier|plan|limit|quota/i.test(flat),
      `402 body must explain the boundary (upgrade/tier/plan), got: ${flat.slice(0, 300)}`,
    );

    // Bilingual contract (moved here from step 2 when /v1/usage opened up).
    const err = (body['error'] ?? {}) as Record<string, unknown>;
    assert.equal(err['code'], 'UPGRADE_REQUIRED', 'the tier gate must name its code');
    assert.match(String(err['message'] ?? ''), /plan|tier|free/i, 'EN message must explain the boundary');
    assert.ok(
      String(err['message_fr'] ?? '').length > 0 && !/inconnue/i.test(String(err['message_fr'])),
      `FR message must be real, got: ${String(err['message_fr'])}`,
    );

    // The 402 body is a Free tenant's usage view on this path — it must carry
    // a real summary, not a hardcoded zero.
    const meta = (body['meta'] ?? {}) as Record<string, unknown>;
    const metaUsage = (meta['usage'] ?? {}) as Record<string, unknown>;
    assert.equal(metaUsage['tier'], 'free', 'the 402 body must state the tenant tier');
    assert.equal(
      metaUsage['periodLimit'],
      TIER_LIMITS.free.monthly,
      'the 402 body must state the free monthly limit',
    );
    assert.ok(
      typeof metaUsage['periodCalls'] === 'number' && (metaUsage['periodCalls'] as number) > 0,
      `meta.usage.periodCalls must report the tenant's real monthly count, got: ${String(metaUsage['periodCalls'])}`,
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
