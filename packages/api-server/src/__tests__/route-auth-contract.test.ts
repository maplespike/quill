import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, ROUTES } from '../index.js';
import { NodeSqliteStorage } from '../node-sqlite-storage.js';
import { MemoryCache } from '../storage.js';

/**
 * The gateway auth contract, route by route.
 *
 * PUBLIC — reachable with no credentials at all (health, docs, signup, public data).
 * HANDLER — the handler enforces its own credential (signed event, internal token,
 *   operator shared secret), so the key gate never runs.
 * Any route in neither list requires a tenant API key.
 *
 * A route whose declaration, this table, or the gateway's behavior disagree fails
 * the test below, so a new route cannot quietly pick up an exemption.
 */
const PUBLIC = [
  'GET /v1/health',
  'GET /v1/version',
  'GET /v1/status',
  'GET /v1/compliance',
  'GET /v1/onboarding',
  'POST /v1/contact',
  'POST /v1/register',
  'GET /v1/verify/{token}',
  'GET /v1/gov/releases',
  'GET /v1/citation/{id}',
  'GET /v1/claims/verify/{hash}',
  'POST /v1/claims/verify',
  'GET /v1/claims/latest',
  'GET /v1/security/audit-summary',
  'GET /v1/billing/plans',
  'POST /v1/ai_ask',
  'POST /v1/ai/ask',
  'GET /v1/astral/health',
  'GET /v1/astral/web3/chains',
  'POST /v1/astral/web3/nonce',
  'POST /v1/astral/web3/verify',
  'POST /v1/astral/fido2/register/options',
  'POST /v1/astral/fido2/register/verify',
  'POST /v1/astral/fido2/authenticate/options',
  'POST /v1/astral/fido2/authenticate/verify',
  'POST /v1/astral/web3/solana/nonce',
  'POST /v1/astral/web3/solana/verify',
  'GET /v1/openapi.json',
  'GET /v1/llms.txt',
  'GET /v1/llms-full.txt',
  'GET /v1/auth/oauth/providers',
  'GET /v1/auth/oauth/exchange',
  'GET /v1/auth/oauth/{provider}',
  'GET /v1/auth/oauth/{provider}/callback',
  'GET /v1/auth/github',
  'GET /v1/auth/github/callback',
  'POST /v1/auth/refresh',
  'POST /v1/auth/logout',
  'GET /v1/auth/me',
  'POST /v1/auth/web3/challenge',
  'POST /v1/auth/web3/login',
  'POST /v1/auth/passkey/register/begin',
  'POST /v1/auth/passkey/register/complete',
  'POST /v1/auth/passkey/login/begin',
  'POST /v1/auth/passkey/login/complete',
  'GET /v1/auth/passkey/credentials',
  'DELETE /v1/auth/passkey/credentials/{id}',
  'GET /v1/engine/status',
  'GET /v1/data/quality',
  'GET /v1/ingest/status',
];

const HANDLER = [
  'POST /v1/billing/stripe/webhook',
  'POST /v1/billing/reconcile-expiry',
  'POST /v1/internal/ingest-report',
];

/** Routes that take a key and must keep taking one, with a self-authenticating header added. */
const KEY_ROUTES_WITH_OPERATOR_HEADERS = [
  ['GET', '/v1/usage'],
  ['GET', '/v1/keys'],
  ['GET', '/v1/billing/stripe/status'],
  ['POST', '/v1/billing/stripe/checkout'],
  ['POST', '/v1/billing/reconcile'],
  ['GET', '/v1/billing/tax/status'],
] as const;

/** One path per route: its pattern with a {name} placeholder for each parameter. */
function routePath(route: (typeof ROUTES)[number]): string {
  let path = route.pattern.source.replace(/^\^/, '').replace(/\\(.)/g, '$1').replace(/\/\?\$$/, '').replace(/\$$/, '');
  for (const name of route.params) path = path.replace(/\(\[\^\/\]\+\)/, `{${name}}`);
  return path;
}

describe('gateway auth contract', () => {
  let db: NodeSqliteStorage;
  let cache: MemoryCache;
  let client = 0;

  const realFetch = globalThis.fetch;

  before(() => {
    db = new NodeSqliteStorage(':memory:');
    cache = new MemoryCache();
    // No route under contract may reach the network: the astral proxy and the
    // security summary would otherwise answer from (or hang on) a live service.
    globalThis.fetch = async () => { throw new Error('Outbound requests forbidden in the auth contract'); };
  });

  after(() => {
    globalThis.fetch = realFetch;
    db.close();
  });

  async function call(path: string, method: string, headers: Record<string, string> = {}) {
    // A fresh client IP per request: the anonymous rate limiter is shared state and
    // would otherwise answer 429 where the gate under test should answer 401.
    client += 1;
    const res = await handleRequest(
      new Request(`http://contract.test${path}`, {
        method,
        headers: { 'CF-Connecting-IP': `10.${client % 250}.${Math.floor(client / 250)}.1`, ...headers },
      }),
      { ENVIRONMENT: 'test' },
      db,
      cache,
    );
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  /** Only the gate's own 401 proves the route required a tenant key. */
  function gated(status: number, body: unknown): boolean {
    return status === 401
      && (body as { error?: { message?: string } } | null)?.error?.message?.startsWith('Valid API key required') === true;
  }

  function declared(key: string): 'key' | 'public' | 'handler' {
    if (HANDLER.includes(key)) return 'handler';
    return PUBLIC.includes(key) ? 'public' : 'key';
  }

  it('declares, and enforces, the auth of every route', async () => {
    const seen = new Set<string>();
    for (const route of ROUTES) {
      const key = `${route.method} ${routePath(route)}`;
      const expected = declared(key);
      seen.add(key);
      assert.equal(route.auth ?? 'key', expected, `auth declaration for ${key}`);

      const path = routePath(route).replace(/\{[^}]+\}/g, 'sample');
      const plain = await call(path, route.method);
      assert.equal(gated(plain.status, plain.body), expected === 'key', `key gate for ${key} (${plain.status})`);
      if (expected === 'handler') {
        assert.ok(plain.status >= 400, `${key} must reject a request without its own credential (${plain.status})`);
      }

      // Handler identity must not matter: the declaration is what decides.
      const handler = route.handler;
      route.handler = (request, ctx, params) => handler(request, ctx, params);
      try {
        const wrapped = await call(path, route.method);
        assert.equal(gated(wrapped.status, wrapped.body), expected === 'key', `key gate for wrapped ${key}`);
      } finally {
        route.handler = handler;
      }
    }
    for (const key of [...PUBLIC, ...HANDLER]) {
      assert.ok(seen.has(key), `${key} is listed in the contract but no route declares it`);
    }
  });

  it('never lets a self-authenticating credential unlock a key route', async () => {
    for (const [method, path] of KEY_ROUTES_WITH_OPERATOR_HEADERS) {
      for (const headers of [{ 'X-Billing-Secret': 'synthetic-operator-secret' }, { 'X-Internal-Token': 'synthetic-internal-token' }]) {
        const { status, body } = await call(path, method, headers);
        assert.ok(gated(status, body), `${method} ${path} accepted ${Object.keys(headers)[0]} (${status})`);
      }
    }
  });
});
