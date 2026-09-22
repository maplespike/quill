/**
 * Self-scoped usage read — #891 (gate B2-FREEUSAGE).
 *
 * Before this change a Free tenant could read NOTHING about itself: /v1/me and
 * /v1/usage both answered 402, so the only way to prove a key authenticated was
 * the 401-vs-402 distinction. /v1/usage is now self-scoped for every tier.
 *
 * This file pins the new contract AND the two regressions that were uncovered
 * while opening the endpoint:
 *
 *   R1 — /v1/usage and /v1/me were wrapped in `withRouteCache`, whose cache key
 *        is method:path:search with NO tenant dimension. The first caller's
 *        body was replayed to every other tenant for the whole TTL. Opening
 *        /v1/usage to Free would have leaked one free tenant's counters (and
 *        tenant id) to the next.
 *   R2 — `meta.usage.periodCalls` was hardcoded to 0 with a comment claiming a
 *        middleware filled it; nothing did. The 402 body — a Free tenant's only
 *        usage view on a blocked route — reported "0 calls" to everyone.
 */

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';

import { handleRequest } from '../index.js';
import { NodeSqliteStorage, NodeSqliteCache } from '../node-sqlite-storage.js';
import { TIER_LIMITS } from '../types.js';

// One storage for the whole file — state must survive between steps.
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

const auth = (key: string) => ({ Authorization: `Bearer ${key}` });

const monthKey = () => new Date().toISOString().slice(0, 7);

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
    `register failed (HTTP ${res.status}): ${JSON.stringify(body).slice(0, 200)}`,
  );
  const data = body['data'] as
    | { tenant?: { id?: string }; apiKey?: { key?: string } }
    | undefined;
  assert.ok(data?.tenant?.id && data?.apiKey?.key, 'register must return a tenant id and a key');
  return { id: String(data.tenant.id), key: String(data.apiKey.key) };
}

/** data.usage of a 200 /v1/usage response. */
async function usageOf(tenant: Tenant): Promise<{
  status: number;
  body: Record<string, unknown>;
  data: Record<string, unknown>;
  daily: Record<string, number>;
  monthly: Record<string, number>;
}> {
  const res = await call('/v1/usage', { headers: auth(tenant.key) });
  const body = await json(res);
  const data = (body['data'] ?? {}) as Record<string, unknown>;
  const usage = (data['usage'] ?? {}) as Record<string, Record<string, number>>;
  return {
    status: res.status,
    body,
    data,
    daily: usage['daily'] ?? {},
    monthly: usage['monthly'] ?? {},
  };
}

let tenantA: Tenant;
let tenantB: Tenant;
let tenantC: Tenant;
let tenantD: Tenant;

before(async () => {
  tenantA = await register('Usage A', 'usage-a@example.com');
  tenantB = await register('Usage B', 'usage-b@example.com');
  tenantC = await register('Usage C', 'usage-c@example.com');
  tenantD = await register('Usage D', 'usage-d@example.com');
});

after(() => {
  (db as unknown as { close?: () => void }).close?.();
});

describe('GET /v1/usage — a tenant reads its own consumption', () => {
  test('a free key gets 200 with its own plan and limits', async () => {
    const { status, body, data, daily, monthly } = await usageOf(tenantA);

    assert.equal(status, 200, 'a Free tenant must be able to read its own usage');
    assert.equal(body['success'], true);
    assert.equal(data['scope'], 'self', 'the read must declare that it is self-scoped');

    const tenant = (data['tenant'] ?? {}) as Record<string, unknown>;
    assert.equal(tenant['id'], tenantA.id, 'the read must be scoped to the calling key');
    assert.equal(tenant['tier'], 'free', 'the read must report the calling tenant tier');

    assert.equal(daily['limit'], TIER_LIMITS.free.daily, 'free daily limit must be reported');
    assert.equal(monthly['limit'], TIER_LIMITS.free.monthly, 'free monthly limit must be reported');
    assert.equal(typeof daily['calls'], 'number', 'daily calls must be a number');
    assert.equal(typeof monthly['calls'], 'number', 'monthly calls must be a number');
    assert.equal(daily['remaining'], TIER_LIMITS.free.daily - daily['calls'], 'daily remaining must match');

    const meta = (body['meta'] ?? {}) as Record<string, unknown>;
    const metaUsage = (meta['usage'] ?? {}) as Record<string, unknown>;
    assert.equal(metaUsage['tier'], 'free', 'meta.usage must state the tier');
    assert.equal(metaUsage['periodLimit'], TIER_LIMITS.free.monthly, 'meta.usage must state the monthly limit');
  });

  test('R1 — a second tenant never receives the first tenant numbers (no shared route cache)', async () => {
    // Drive tenant A ahead of tenant B so the two tenants' counters differ.
    await usageOf(tenantA);
    await usageOf(tenantA);

    const a = await usageOf(tenantA);
    const b = await usageOf(tenantB);

    assert.equal(b.status, 200);
    assert.equal((b.data['tenant'] as Record<string, unknown>)['id'], tenantB.id, 'B must read B');
    assert.notEqual(a.monthly['calls'], b.monthly['calls'], 'the two tenants must not share counters');

    // Both numbers must equal what storage actually holds for that tenant.
    const month = monthKey();
    assert.equal(a.monthly['calls'], await db.getMonthlyUsage(tenantA.id, month), 'A must see its own stored count');
    assert.equal(b.monthly['calls'], await db.getMonthlyUsage(tenantB.id, month), 'B must see its own stored count');

    const flatB = JSON.stringify(b.body);
    assert.ok(!flatB.includes(tenantA.id), 'B must never receive tenant A identity');
    assert.ok(!flatB.includes(tenantA.key), 'B must never receive tenant A key material');
    assert.ok(!flatB.includes(tenantB.key), 'responses must not echo raw key material back');
  });

  test('R2 — the free-tier 402 body reports the real monthly count in meta.usage', async () => {
    const month = monthKey();
    const expected = await db.getMonthlyUsage(tenantA.id, month);
    assert.ok(expected > 0, 'this test needs a tenant that has already made calls');

    // A data route is still Pro+: the 402 body is a Free tenant's usage view.
    // /v1/energy authenticates the caller (unlike the auth-exempt public
    // routes), so this body is addressed to tenant A.
    const res = await call('/v1/energy', { headers: auth(tenantA.key) });
    assert.equal(res.status, 402, 'the paid boundary must stay closed for Free');
    const body = await json(res);
    const meta = (body['meta'] ?? {}) as Record<string, unknown>;
    const metaUsage = (meta['usage'] ?? {}) as Record<string, unknown>;

    assert.equal(
      metaUsage['periodCalls'],
      expected,
      'meta.usage.periodCalls must be the tenant real monthly count, not a hardcoded 0',
    );
    assert.equal(metaUsage['tier'], 'free');
    assert.equal(metaUsage['periodLimit'], TIER_LIMITS.free.monthly);

    // The blocked request itself must not have been counted.
    assert.equal(
      await db.getMonthlyUsage(tenantA.id, month),
      expected,
      'a blocked request must not consume quota',
    );
  });

  test('R1 — a tenant-scoped read is never served from the tenant-less route cache (/v1/me)', async () => {
    // /v1/me is Pro+ and returns tenant identity + usage. It used to be cached
    // under a tenant-less key, so the second Pro tenant read the first one's
    // body. Promote two fresh tenants to isolate this from the Free assertions.
    await db.updateTenantStripe(tenantC.id, { tier: 'pro' });
    await db.updateTenantStripe(tenantD.id, { tier: 'pro' });

    const resC = await call('/v1/me', { headers: auth(tenantC.key) });
    assert.equal(resC.status, 200, 'a Pro tenant must reach /v1/me');
    const dataC = ((await json(resC))['data'] ?? {}) as Record<string, unknown>;
    assert.equal(
      (dataC['tenant'] as Record<string, unknown>)['id'],
      tenantC.id,
      'tenant C must read tenant C',
    );

    // Immediately after C's call, D must still read D — never C's cached body.
    const resD = await call('/v1/me', { headers: auth(tenantD.key) });
    assert.equal(resD.status, 200, 'a Pro tenant must reach /v1/me');
    const bodyD = await json(resD);
    const dataD = (bodyD['data'] ?? {}) as Record<string, unknown>;
    assert.equal(
      (dataD['tenant'] as Record<string, unknown>)['id'],
      tenantD.id,
      'tenant D must read tenant D, not a cached response addressed to tenant C',
    );

    const flatD = JSON.stringify(bodyD);
    assert.ok(!flatD.includes(tenantC.id), 'D must never receive tenant C identity');
    assert.ok(!flatD.includes(tenantC.key), 'D must never receive tenant C key material');
  });
});
