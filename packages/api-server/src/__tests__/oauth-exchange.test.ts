import { test } from "node:test";
import assert from "node:assert/strict";

// Smoke tests for the OAuth code-exchange route handler against a real
// (in-process) cache backend. The handler is locked to the
// `oauth:exchange:` key prefix to avoid arbitrary cache-key collisions.

import { oauthExchangeHandler } from "../routes/auth-oauth.js";
import type { RouteContext, MapleSpikeCache } from "../types.js";

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

function makeCtx(): RouteContext {
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
    cache: new InMemoryCache(),
  };
}

test("oauthExchangeHandler returns 400 for missing code", async () => {
  const url = "https://api.maplespike.lan/v1/auth/oauth/exchange";
  const req = new Request(url, { method: "GET", headers: { Accept: "application/json" } });
  const res = await oauthExchangeHandler(req, makeCtx(), {});
  assert.equal(res.status, 400);
  const body = (await res.json()) as { success: boolean; error: { code: string } };
  assert.equal(body.success, false);
  assert.equal(body.error.code, "MISSING_CODE");
});

test("oauthExchangeHandler returns 400 for invalid code", async () => {
  const url = "https://api.maplespike.lan/v1/auth/oauth/exchange?code=invalid-random-code";
  const req = new Request(url, { method: "GET", headers: { Accept: "application/json" } });
  const res = await oauthExchangeHandler(req, makeCtx(), {});
  assert.equal(res.status, 400);
  const body = (await res.json()) as { success: boolean; error: { code: string } };
  assert.equal(body.success, false);
  assert.equal(body.error.code, "INVALID_CODE");
});

test("oauthExchangeHandler rejects codes with extra path segments", async () => {
  const url = "https://api.maplespike.lan/v1/auth/oauth/exchange/foo/bar?code=whatever";
  const req = new Request(url, { method: "GET", headers: { Accept: "application/json" } });
  const res = await oauthExchangeHandler(req, makeCtx(), {});
  assert.equal(res.status, 400);
});
