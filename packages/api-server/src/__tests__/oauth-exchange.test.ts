// SPDX-License-Identifier: AGPL-3.0-only
import { test } from "node:test";
import assert from "node:assert/strict";

// Smoke tests for the OAuth code-exchange route handler against a real
// (in-process) cache backend. The handler is locked to the
// `oauth:exchange:` key prefix to avoid arbitrary cache-key collisions.

import { oauthExchangeHandler } from "../routes/auth-oauth.js";
import { makeCtx } from "./_helpers.js";

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
