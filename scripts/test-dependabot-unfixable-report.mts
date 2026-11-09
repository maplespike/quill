#!/usr/bin/env tsx
/**
 * Unit tests for scripts/gates/dependabot-unfixable-report.mjs.
 *
 * The weekly report is the only place that keeps "Dependabot cannot apply
 * this security update" visible. If its classifier drifts, either the queue
 * goes empty while alerts pile up, or every fixable alert is filed as
 * blocked — both are silent. These fixtures pin the classification, the
 * rendered body (package, range, first patched, reason) and the 403/404
 * "unreadable API is not a failure" contract.
 *
 * Runs as `tsx --test` via `pnpm run test:dependabot-unfixable` (part of
 * `pnpm test`) and as a CI step in .github/workflows/ci.yml.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ISSUE_TITLE,
  REASON_MAJOR,
  REASON_NO_PATCH,
  classifyAlert,
  collectUnfixable,
  collectUpdateFailures,
  parseVersionTriple,
  renderIssueBody,
  run
} from './gates/dependabot-unfixable-report.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const alerts = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/fixtures/dependabot-alerts.json'), 'utf8'));

test('parseVersionTriple reads the first semantic triple', () => {
  assert.deepEqual(parseVersionTriple('>= 6.0.0, < 6.2.1'), {
    major: 6,
    minor: 0,
    patch: 0,
    raw: '6.0.0'
  });
  assert.equal(parseVersionTriple('unknown'), null);
  assert.equal(parseVersionTriple(null), null);
});

test('an alert with no published patch is unfixable', () => {
  const lru = alerts.find((a: any) => a.dependency.package.name === 'lru');
  const entry = classifyAlert(lru);
  assert.ok(entry);
  assert.equal(entry!.packageName, 'lru');
  assert.equal(entry!.vulnerableRange, '>= 3.0.0, < 3.1.1');
  assert.equal(entry!.firstPatched, null);
  assert.equal(entry!.reason, REASON_NO_PATCH);
});

test('a patch only in the next major is blocked by the parent range', () => {
  const tar = alerts.find((a: any) => a.dependency.package.name === 'tar');
  const entry = classifyAlert(tar);
  assert.ok(entry);
  assert.equal(entry!.firstPatched, '7.5.16');
  assert.ok(entry!.reason.startsWith(REASON_MAJOR), entry!.reason);
  assert.match(entry!.reason, /6\.x -> 7\.x/);
});

test('a patch inside the same major is not reported', () => {
  const rustls = alerts.find((a: any) => a.dependency.package.name === 'rustls');
  const nodemailer = alerts.find((a: any) => a.dependency.package.name === 'nodemailer');
  const fastUri = alerts.find((a: any) => a.dependency.package.name === 'fast-uri');
  assert.equal(classifyAlert(rustls), null);
  assert.equal(classifyAlert(nodemailer), null);
  // fast-uri's patch is a major bump, so it stays.
  assert.ok(classifyAlert(fastUri));
});

test('collectUnfixable returns only blocked alerts, sorted by package', () => {
  const items = collectUnfixable(alerts);
  assert.deepEqual(
    items.map((i: any) => i.packageName),
    ['fast-uri', 'lru', 'tar']
  );
  for (const item of items) {
    assert.ok(item.vulnerableRange, 'missing vulnerable range');
    assert.ok(item.reason, 'missing reason');
    assert.ok('firstPatched' in item);
  }
});

test('collectUnfixable tolerates malformed and empty input', () => {
  assert.deepEqual(collectUnfixable([]), []);
  assert.deepEqual(collectUnfixable([{}, { security_vulnerability: null }] as any), []);
});

test('rendered body names each package, range, first patch and reason', () => {
  const body = renderIssueBody(collectUnfixable(alerts), [], new Date('2026-11-09T00:00:00Z'));
  assert.match(body, /Generated 2026-11-09/);
  assert.match(body, /`fast-uri`/);
  assert.match(body, /`lru`/);
  assert.match(body, /`tar`/);
  assert.match(body, />= 6\.0\.0, < 6\.2\.1/);
  assert.match(body, /`7\.5\.16`/);
  assert.match(body, /\(none published\)/);
  assert.match(body, /major outside parent range/);
});

test('rendered body ends with the triage rule and never calls this an infra flake', () => {
  const body = renderIssueBody([], [], new Date('2026-11-09T00:00:00Z'));
  assert.match(body, /## Triage rule/);
  assert.match(body, /Dismiss with a reason/);
  assert.match(body, /Wait for upstream/);
  assert.match(body, /pnpm\.overrides/);
  assert.match(body, /infra flake/);
  assert.match(body, /not[\s\S]{0,40}infra flake/);
  assert.doesNotMatch(body, /flaky (?:test|runner)/);
  assert.match(body, /None this week/);
});

test('collectUpdateFailures keeps only security_update_not_possible jobs', () => {
  const jobs = [
    { dependency: { package: { name: 'tar', ecosystem: 'npm' } }, error: { detail: 'security_update_not_possible' } },
    { dependency: { package: { name: 'ws', ecosystem: 'npm' } }, error: { detail: 'dependency_file_not_found' } },
    { package: { name: 'lru', ecosystem: 'npm' }, message: 'security_update_not_possible: no patched release' }
  ];
  const found = collectUpdateFailures(jobs);
  assert.deepEqual(
    found.map((f: any) => f.packageName),
    ['tar', 'lru']
  );
  assert.equal(found[0]!.error, 'security_update_not_possible');
});

/** Minimal fake fetch: route -> handler. */
function fakeFetch(routes: Array<{ match: (url: string, init: any) => boolean; respond: (url: string, init: any) => any }>) {
  const calls: Array<{ url: string; init: any }> = [];
  const impl = async (url: string, init: any = {}) => {
    calls.push({ url: String(url), init });
    for (const route of routes) {
      if (route.match(String(url), init)) return route.respond(String(url), init);
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  return { impl: impl as any, calls };
}

const json = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body
  }) as any;

test('403 from the alerts API logs a notice and exits 0', async () => {
  const logs: string[] = [];
  const { impl, calls } = fakeFetch([
    { match: (u) => u.includes('/dependabot/alerts'), respond: () => json(403, { message: 'Forbidden' }) }
  ]);
  const code = await run({
    fetchImpl: impl,
    env: { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'maplespike/quill' },
    log: (...args: any[]) => logs.push(args.join(' '))
  });
  assert.equal(code, 0);
  assert.ok(logs.some((l) => l.startsWith('::notice::')), logs.join('\n'));
  assert.equal(calls.length, 1, 'must not touch the issues API after a 403');
});

test('404 from the alerts API logs a notice and exits 0', async () => {
  const logs: string[] = [];
  const { impl } = fakeFetch([
    { match: (u) => u.includes('/dependabot/alerts'), respond: () => json(404, { message: 'Not Found' }) }
  ]);
  const code = await run({
    fetchImpl: impl,
    env: { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'maplespike/quill' },
    log: (...args: any[]) => logs.push(args.join(' '))
  });
  assert.equal(code, 0);
  assert.ok(logs.some((l) => l.includes('404')));
});

test('opens the report issue when it does not exist', async () => {
  const logs: string[] = [];
  let posted: any = null;
  const { impl, calls } = fakeFetch([
    { match: (u) => u.includes('/dependabot/alerts'), respond: () => json(200, alerts) },
    { match: (u) => u.includes('/dependabot/jobs'), respond: () => json(404, {}) },
    { match: (u) => u.includes('/issues?'), respond: () => json(200, []) },
    {
      match: (u, init) => u.endsWith('/issues') && init.method === 'POST',
      respond: (_u, init) => {
        posted = JSON.parse(init.body);
        return json(201, { number: 4242 });
      }
    }
  ]);
  const code = await run({
    fetchImpl: impl,
    env: { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'maplespike/quill' },
    log: (...args: any[]) => logs.push(args.join(' '))
  });
  assert.equal(code, 0);
  assert.ok(posted, 'no issue was created');
  assert.equal(posted.title, ISSUE_TITLE);
  assert.match(posted.body, /`tar`/);
  assert.match(posted.body, /## Triage rule/);
  assert.match(posted.body, /infra flake/);
  assert.equal(posted.labels, undefined, 'the report must not change labels');
  assert.ok(calls.some((c) => c.url.includes('/issues')));
  assert.ok(logs.some((l) => l.includes('#4242')));
});

test('updates the existing issue instead of opening a duplicate', async () => {
  let patched: any = null;
  let created = false;
  const { impl } = fakeFetch([
    { match: (u) => u.includes('/dependabot/alerts'), respond: () => json(200, alerts) },
    { match: (u) => u.includes('/dependabot/jobs'), respond: () => json(403, {}) },
    {
      match: (u) => u.includes('/issues?'),
      respond: () => json(200, [{ number: 77, title: ISSUE_TITLE, body: 'old' }])
    },
    {
      match: (u, init) => u.endsWith('/issues/77') && init.method === 'PATCH',
      respond: (_u, init) => {
        patched = JSON.parse(init.body);
        return json(200, { number: 77 });
      }
    },
    {
      match: (u, init) => u.endsWith('/issues') && init.method === 'POST',
      respond: () => {
        created = true;
        return json(201, {});
      }
    }
  ]);
  const code = await run({
    fetchImpl: impl,
    env: { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'maplespike/quill' },
    log: () => {}
  });
  assert.equal(code, 0);
  assert.equal(created, false, 'must not open a second issue');
  assert.ok(patched);
  assert.match(patched.body, /`lru`/);
  assert.equal(patched.labels, undefined);
});

test('a missing repository or token is a clean no-op, not a crash', async () => {
  assert.equal(await run({ fetchImpl: (async () => { throw new Error('no network') }) as any, env: {}, log: () => {} }), 1);
  assert.equal(
    await run({
      fetchImpl: (async () => { throw new Error('no network') }) as any,
      env: { GITHUB_REPOSITORY: 'maplespike/quill' },
      log: () => {}
    }),
    0
  );
});
