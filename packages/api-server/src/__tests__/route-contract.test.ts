// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Route-table contract tests.
 *
 * The router takes the FIRST matching pattern — a wildcard registered
 * before a specific route silently swallows it. That happened live on
 * 2026-09-21: `/v1/auth/oauth/exchange` was registered after the
 * `/v1/auth/oauth/:provider` wildcard, so every browser OAuth login died
 * at redemption with `OAUTH_PROVIDER_NOT_FOUND: provider "exchange"`.
 *
 * These tests pin the ordering contract so a future table edit cannot
 * reintroduce the shadowing.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ROUTES } from '../index.js';

function firstMatch(path: string, method = 'GET') {
  return ROUTES.find((r) => r.method === method && r.pattern.test(path));
}

describe('route table — first-match contract', () => {
  it('/v1/auth/oauth/exchange resolves to the exchange route (no :provider params)', () => {
    const m = firstMatch('/v1/auth/oauth/exchange');
    assert.ok(m, 'no route matched /v1/auth/oauth/exchange');
    assert.deepEqual(
      m.params,
      [],
      'the :provider wildcard swallowed /exchange — specific routes must precede wildcards',
    );
  });

  it('/v1/auth/oauth/providers resolves to the providers route', () => {
    const m = firstMatch('/v1/auth/oauth/providers');
    assert.ok(m, 'no route matched /v1/auth/oauth/providers');
    assert.deepEqual(m.params, []);
  });

  it('/v1/auth/oauth/github resolves to the login wildcard (provider param)', () => {
    const m = firstMatch('/v1/auth/oauth/github');
    assert.ok(m, 'no route matched /v1/auth/oauth/github');
    assert.deepEqual(m.params, ['provider']);
  });

  it('/v1/auth/oauth/github/callback resolves to the callback route', () => {
    const m = firstMatch('/v1/auth/oauth/github/callback');
    assert.ok(m, 'no route matched /v1/auth/oauth/github/callback');
    assert.deepEqual(m.params, ['provider']);
  });

  it('/exchange is registered BEFORE the :provider wildcard', () => {
    const exchangeIdx = ROUTES.findIndex(
      (r) => r.params.length === 0 && r.pattern.test('/v1/auth/oauth/exchange'),
    );
    const wildcardIdx = ROUTES.findIndex(
      (r) => r.params.includes('provider') && r.pattern.test('/v1/auth/oauth/github'),
    );
    assert.ok(exchangeIdx !== -1, 'exchange route missing from the table');
    assert.ok(wildcardIdx !== -1, ':provider wildcard missing from the table');
    assert.ok(exchangeIdx < wildcardIdx, '/exchange must precede the :provider wildcard');
  });
});
