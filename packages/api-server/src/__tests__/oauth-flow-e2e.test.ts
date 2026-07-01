import { test } from "node:test";
import assert from "node:assert/strict";

// E2E test of the OAuth code-exchange flow against a real (in-process)
// cache backend. Documents the contract consumers of /v1/auth/oauth/*
// depend on:
//   1. POST /v1/auth/oauth/{provider}/callback (browser) -> 302 redirect
//      to /auth/callback?code=<uuid> with Set-Cookie: session=<jwt>
//   2. GET /v1/auth/oauth/exchange?code=<uuid>                  -> JWT payload
//   3. The same code cannot be redeemed twice (single-use).
//   4. After the TTL elapses, the code cannot be redeemed.
//   5. The code is stored under the `oauth:exchange:` key prefix so
//      arbitrary cache keys cannot collide.

import type { RouteHandler, RouteContext, MapleSpikeCache } from "../types.js";

class InMemoryCache implements MapleSpikeCache {
  private store = new Map<string, { value: string; expires: number }>();
  async get(key: string) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }
  async put(key: string, value: string, ttlSeconds?: number) {
    this.store.set(key, { value, expires: Date.now() + (ttlSeconds ?? 60) * 1000 });
  }
  async delete(key: string) {
    this.store.delete(key);
  }
}

function makeCtx(opts: { cache?: MapleSpikeCache } = {}): RouteContext {
  return {
    tenant: {
      id: "anon",
      name: "Anonymous",
      emailVerified: false,
      tier: "free",
      isActive: true,
      journalismMode: false,
    },
    apiKeyId: "",
    requestId: "test-req",
    startTime: Date.now(),
    env: {},
    db: {} as any,
    cache: opts.cache ?? new InMemoryCache(),
  };
}

async function mintExchangeEntry(
  cache: MapleSpikeCache,
  opts: { isNewUser?: boolean; apiKey?: string } = {},
): Promise<{ code: string }> {
  const code = crypto.randomUUID();
  await cache.put(
    `oauth:exchange:${code}`,
    JSON.stringify({
      token: "jwt.test.fake",
      provider: "github",
      name: "Test User",
      isNewUser: opts.isNewUser ?? false,
      apiKey: opts.apiKey ? { key: opts.apiKey } : undefined,
    }),
    60,
  );
  return { code };
}

test("oauthExchangeHandler redeems a fresh code once and returns the JWT payload", async () => {
  const cache = new InMemoryCache();
  const ctx = makeCtx({ cache });
  const { code } = await mintExchangeEntry(cache, { isNewUser: true, apiKey: "mp_live_test" });

  const url = `https://api.maplespike.lan/v1/auth/oauth/exchange?code=${encodeURIComponent(code)}`;
  const res = await (
    await import("../routes/auth-oauth.js")
  ).oauthExchangeHandler(new Request(url, { method: "GET", headers: { Accept: "application/json" } }), ctx, {});

  assert.equal(res.status, 200);
  const body = (await res.json()) as { success: boolean; data: { token: string; provider: string; isNewUser: boolean; apiKey: { key: string } } };
  assert.equal(body.success, true);
  assert.equal(body.data.token, "jwt.test.fake");
  assert.equal(body.data.provider, "github");
  assert.equal(body.data.isNewUser, true);
  assert.equal(body.data.apiKey.key, "mp_live_test");
});

test("oauthExchangeHandler rejects double-redemption (single-use)", async () => {
  const cache = new InMemoryCache();
  const ctx = makeCtx({ cache });
  const { code } = await mintExchangeEntry(cache);
  const req = new Request(`https://api.maplespike.lan/v1/auth/oauth/exchange?code=${code}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const first = await (
    await import("../routes/auth-oauth.js")
  ).oauthExchangeHandler(req, ctx, {});
  assert.equal(first.status, 200);

  const second = await (
    await import("../routes/auth-oauth.js")
  ).oauthExchangeHandler(req, ctx, {});
  assert.equal(second.status, 400);
  const body = (await second.json()) as { error: { code: string } };
  assert.equal(body.error.code, "INVALID_CODE");
});

test("oauthExchangeHandler rejects expired codes", async () => {
  const cache = new InMemoryCache();
  const ctx = makeCtx({ cache });
  // Bypass the helper to insert a code that's already expired.
  const code = "expired-code";
  await cache.put(`oauth:exchange:${code}`, JSON.stringify({ token: "x", provider: "x", name: "x", isNewUser: false }), 0);
  // Sleeping is racy; instead, force expiry by manually clearing.
  // We do that by writing with a past expires timestamp.
  (cache as any).store.get(`oauth:exchange:${code}`).expires = Date.now() - 10;
  const res = await (
    await import("../routes/auth-oauth.js")
  ).oauthExchangeHandler(
    new Request(`https://api.maplespike.lan/v1/auth/oauth/exchange?code=${code}`, { method: "GET", headers: { Accept: "application/json" } }),
    ctx,
    {},
  );
  assert.equal(res.status, 400);
});

test("oauthExchangeHandler rejects codes with wrong prefix namespace", async () => {
  // Confirm the exchange handler only looks under oauth:exchange:*.
  // A bare cache key (no prefix) should NOT be returned.
  const cache = new InMemoryCache();
  await cache.put("some-other-key", JSON.stringify({ token: "should-not-leak" }), 60);
  const ctx = makeCtx({ cache });

  const res = await (
    await import("../routes/auth-oauth.js")
  ).oauthExchangeHandler(
    new Request("https://api.maplespike.lan/v1/auth/oauth/exchange?code=some-other-key", { method: "GET", headers: { Accept: "application/json" } }),
    ctx,
    {},
  );
  assert.equal(res.status, 400);
});

test("oauthExchangeHandler returns 400 for missing code", async () => {
  const res = await (
    await import("../routes/auth-oauth.js")
  ).oauthExchangeHandler(
    new Request("https://api.maplespike.lan/v1/auth/oauth/exchange", { method: "GET", headers: { Accept: "application/json" } }),
    makeCtx(),
    {},
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, "MISSING_CODE");
});
