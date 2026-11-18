// SPDX-License-Identifier: AGPL-3.0-only
/**
 * OAuth exchange contract tests (regression: 2026-09-21).
 *
 * Live bug: the token exchange built `redirect_uri` from the provider's
 * DISPLAY name — `/oauth/GitHub/callback` (capitalized) — while the
 * authorize step and the app's registered URI use the lowercase
 * `/oauth/github/callback`. GitHub rejected every exchange with
 * `redirect_uri_mismatch`, returned as an HTTP 200 error body that the old
 * code passed through as an undefined token (silent `login_failed`).
 *
 * These tests pin the exchange contract:
 *   1. redirect_uri must use the LOWERCASED provider name (the route key)
 *   2. an error body without access_token must THROW (never return undefined)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { exchangeCode, type OAuthProvider } from '../auth/oauth.js';

const provider: OAuthProvider = {
  name: 'GitHub', // display name — capitalized, like the live built-in
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  authorizeUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  userInfoUrl: 'https://api.github.com/user',
  scope: 'read:user user:email',
  mapProfile: () => ({ provider: 'github', providerId: '1', email: null, name: null, avatarUrl: null }),
};

const originalFetch = globalThis.fetch;

function captureFetch(response: { status?: number; body: unknown }) {
  let captured: { url: string; init?: RequestInit } | null = null;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify(response.body), {
      status: response.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  return () => captured;
}

describe('exchangeCode — redirect_uri contract', () => {
  beforeEach(() => {
    // tests own global fetch for the duration
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends the LOWERCASE route key in redirect_uri (not the display name)', async () => {
    const getCaptured = captureFetch({ body: { access_token: 'tok_123' } });

    const token = await exchangeCode(provider, 'code-abc');
    assert.equal(token, 'tok_123');

    const captured = getCaptured();
    assert.ok(captured, 'fetch was not called');
    const body = JSON.parse(String(captured!.init?.body)) as Record<string, string>;
    assert.ok(
      body.redirect_uri.endsWith('/github/callback'),
      `redirect_uri must end with lowercase /github/callback — got: ${body.redirect_uri}`,
    );
    assert.ok(
      !body.redirect_uri.includes('/GitHub/'),
      `redirect_uri must never contain the display name — got: ${body.redirect_uri}`,
    );
  });

  it('throws on an HTTP 200 error body without access_token (GitHub error format)', async () => {
    captureFetch({
      body: {
        error: 'redirect_uri_mismatch',
        error_description: 'The redirect_uri MUST match the registered callback URL.',
      },
    });

    await assert.rejects(
      () => exchangeCode(provider, 'code-abc'),
      (err: Error) => {
        assert.match(err.message, /redirect_uri_mismatch/);
        return true;
      },
      'an error body must throw with the provider error surfaced',
    );
  });

  it('throws on a non-OK HTTP status', async () => {
    captureFetch({ status: 500, body: {} });
    await assert.rejects(() => exchangeCode(provider, 'code-abc'), /Token exchange failed: 500/);
  });
});
