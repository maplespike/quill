/**
 * Legacy GitHub sign-in (/v1/auth/github[/callback]).
 *
 * The old handler set an API-origin cookie and redirected to the portal root,
 * skipping /auth/callback, so users landed anonymous on /me. Both legacy
 * routes must now start the generic flow: a 302 to GitHub whose redirect_uri
 * is the working /v1/auth/oauth/github/callback, with a state nonce that the
 * generic callback can verify.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'test-client-secret';
process.env.MAPLESPIKE_OAUTH_REDIRECT_BASE = 'https://api.example.test/v1/auth/oauth';

type Route = { pattern: RegExp; method: string; handler: (...a: any[]) => Promise<Response> };
let routes: Route[] = [];
let legacyGithubLoginHandler: (...a: any[]) => Promise<Response>;
let consumeChallenge: (key: string) => string | null | undefined;

before(async () => {
  ({ legacyGithubLoginHandler } = await import('../routes/auth-oauth.js'));
  ({ consumeChallenge } = (await import('../auth/challenges.js')) as any);
  routes = ((await import('../index.js')) as any).ROUTES as Route[];
});

const ctx = { requestId: 'req-test' } as any;

for (const path of ['/v1/auth/github', '/v1/auth/github/callback?code=stale&state=x']) {
  test(`GET ${path} redirects into the generic GitHub OAuth flow`, async () => {
    const req = new Request(`https://api.example.test${path}`, { headers: { Accept: 'text/html' } });
    const res = await legacyGithubLoginHandler(req, ctx, {});
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('Set-Cookie'), null, 'legacy route must not set an API-origin session');
    const loc = new URL(res.headers.get('Location') ?? '');
    assert.equal(loc.origin + loc.pathname, 'https://github.com/login/oauth/authorize');
    assert.equal(loc.searchParams.get('redirect_uri'), 'https://api.example.test/v1/auth/oauth/github/callback');
    const state = loc.searchParams.get('state');
    assert.ok(state, 'state nonce present');
    assert.ok(consumeChallenge(`oauth:github:${state}`), 'state is registered for the generic callback');
  });
}

test('legacy routes are wired to the redirect handler', () => {
  for (const p of ['/v1/auth/github', '/v1/auth/github/callback']) {
    const r = routes.find((x) => x.method === 'GET' && x.pattern.test(p));
    assert.ok(r, `no route for ${p}`);
    assert.equal(r!.handler, legacyGithubLoginHandler, `${p} must use legacyGithubLoginHandler`);
  }
});
