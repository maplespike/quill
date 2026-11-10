// SPDX-License-Identifier: AGPL-3.0-only
import { test } from "node:test";
import assert from "node:assert/strict";

// E2E test of the OAuth code-exchange flow against a real (in-process)
// cache backend. Documents the contract consumers of /v1/auth/oauth/*
// depend on:
//   1. POST /v1/auth/oauth/{provider}/callback (browser) -> 302 redirect
//      to /auth/callback?code=<uuid> with Set-Cookie: session=<jwt>
//   2. GET /v1/auth/oauth/exchange?code=<uuid>                  -> JWT payload
//   3. The same code cannot be redeemed twice (single-use).
//   4. Each terminal state (INVALID_CODE / ALREADY_CONSUMED) maps to the
//      right code so callers can show a useful error.
//   5. After the TTL elapses, the code cannot be redeemed.
//   6. The code is stored under the `oauth:exchange:` key prefix so
//      arbitrary cache keys cannot collide.

import { oauthExchangeHandler } from "../routes/auth-oauth.js";
import { InMemoryCache, makeCtx } from "./_helpers.js";

async function mintEntry(
  cache: InMemoryCache,
  opts: { isNewUser?: boolean; apiKey?: string; sentinel?: boolean } = {},
): Promise<{ code: string }> {
  const code = crypto.randomUUID();
  if (opts.sentinel) {
    await cache.put(`oauth:exchange:${code}`, "__consumed__", 60);
    return { code };
  }
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
  const { code } = await mintEntry(cache, { isNewUser: true, apiKey: "mp_live_test" });

  const url = `https://api.maplespike.lan/v1/auth/oauth/exchange?code=${encodeURIComponent(code)}`;
  const res = await oauthExchangeHandler(
    new Request(url, { method: "GET", headers: { Accept: "application/json" } }),
    ctx,
    {},
  );

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
  const { code } = await mintEntry(cache);
  const req = new Request(`https://api.maplespike.lan/v1/auth/oauth/exchange?code=${code}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const first = await oauthExchangeHandler(req, ctx, {});
  assert.equal(first.status, 200);

  const second = await oauthExchangeHandler(req, ctx, {});
  assert.equal(second.status, 400);
  const body = (await second.json()) as { error: { code: string } };
  // MemoryCache.delete is synchronous, so the second call sees the
  // deleted entry (no sentinel value) -> INVALID_CODE. The sentinel
  // path is exercised in the next test.
  assert.equal(body.error.code, "INVALID_CODE");
});

test("oauthExchangeHandler rejects ALREADY_CONSUMED sentinel values", async () => {
  // Simulates the KV eventual-consistency window: another request has
  // already started consuming this code and the sentinel is now visible.
  const cache = new InMemoryCache();
  const ctx = makeCtx({ cache });
  const { code } = await mintEntry(cache, { sentinel: true });

  const res = await oauthExchangeHandler(
    new Request(`https://api.maplespike.lan/v1/auth/oauth/exchange?code=${code}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    }),
    ctx,
    {},
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: { code: string; message: string } };
  assert.equal(body.error.code, "ALREADY_CONSUMED");
  assert.match(body.error.message, /already been used/);
});

test("oauthExchangeHandler rejects expired codes", async () => {
  const cache = new InMemoryCache();
  const ctx = makeCtx({ cache });
  const code = "expired-code";
  await cache.put(`oauth:exchange:${code}`, JSON.stringify({ token: "x", provider: "x", name: "x", isNewUser: false }), 60);
  // Backdate the TTL so the next read observes expiry without sleeping.
  await cache.expireAt(`oauth:exchange:${code}`, Date.now() - 10);
  const res = await oauthExchangeHandler(
    new Request(`https://api.maplespike.lan/v1/auth/oauth/exchange?code=${code}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    }),
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

  const res = await oauthExchangeHandler(
    new Request("https://api.maplespike.lan/v1/auth/oauth/exchange?code=some-other-key", {
      method: "GET",
      headers: { Accept: "application/json" },
    }),
    ctx,
    {},
  );
  assert.equal(res.status, 400);
});

test("oauthExchangeHandler returns 400 for missing code", async () => {
  const res = await oauthExchangeHandler(
    new Request("https://api.maplespike.lan/v1/auth/oauth/exchange", {
      method: "GET",
      headers: { Accept: "application/json" },
    }),
    makeCtx(),
    {},
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, "MISSING_CODE");
});
