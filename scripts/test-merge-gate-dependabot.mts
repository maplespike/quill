#!/usr/bin/env tsx
/**
 * Unit tests for the Dependabot semver-patch/minor merge gate and pinned `gh`
 * enforcement in `.github/workflows/merge-when-green.yml` (#1388, #1392).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = path.join(REPO, '.github/workflows/merge-when-green.yml');
const DEPENDABOT_JQ = path.join(REPO, 'scripts/gates/dependabot-gate.jq');
const NORMALIZE_JQ = path.join(REPO, 'scripts/gates/normalize-pull.jq');

const workflow = () => fs.readFileSync(WORKFLOW, 'utf8');

function embedded(text: string, name: string): string {
  const begin = `# BEGIN ${name}`;
  const end = `# END ${name}`;
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.includes(begin));
  const stop = lines.findIndex((line, index) => index >= start && line.includes(end));
  assert.ok(start >= 0 && stop > start, `missing ${begin} .. ${end}`);
  const block = lines.slice(start, stop + 1);
  const indent = block[0].match(/^ */)?.[0].length ?? 0;
  return block.map((line) => line.slice(indent)).join('\n') + '\n';
}

type Decision = { allow: boolean; kind: string; grouped: boolean; reason: string };

function decide(pull: { author: string; title: string; body?: string }): Decision {
  const normalized = execFileSync('jq', ['-c', '-f', NORMALIZE_JQ], {
    encoding: 'utf8',
    input: JSON.stringify({
      state: 'open',
      draft: false,
      mergeable: true,
      mergeable_state: 'clean',
      head: { sha: 'a'.repeat(40), repo: { full_name: 'maplespike/quill' } },
      labels: [{ name: 'ready-to-merge' }],
      user: { login: pull.author },
      title: pull.title,
      body: pull.body ?? '',
    }),
  });
  const out = execFileSync('jq', ['-c', '-f', DEPENDABOT_JQ], {
    encoding: 'utf8',
    input: normalized,
  });
  return JSON.parse(out) as Decision;
}

test('merge-when-green.yml embeds scripts/gates/dependabot-gate.jq verbatim', () => {
  assert.equal(embedded(workflow(), 'dependabot-gate.jq'), fs.readFileSync(DEPENDABOT_JQ, 'utf8'));
});

test('allows single-package Dependabot semver-patch updates', () => {
  const res = decide({
    author: 'dependabot[bot]',
    title: 'chore(deps): bump hono from 4.13.11 to 4.13.16',
    body: 'Bumps [hono](https://github.com/honojs/hono) from 4.13.11 to 4.13.16.',
  });
  assert.equal(res.allow, true);
  assert.equal(res.kind, 'patch');
  assert.equal(res.grouped, false);
});

test('allows single-package Dependabot semver-minor updates (including 0.x and app/dependabot)', () => {
  const res = decide({
    author: 'app/dependabot',
    title: 'chore(deps): bump fast-xml-parser from 5.11.2 to 5.12.0',
    body: 'Bumps [fast-xml-parser](https://example.com) from 5.11.2 to 5.12.0.',
  });
  assert.equal(res.allow, true);
  assert.equal(res.kind, 'minor');
  assert.equal(res.grouped, false);

  const zeroX = decide({
    author: 'dependabot[bot]',
    title: 'chore(deps): bump @hono/zod-validator from 0.7.6 to 0.9.1',
  });
  assert.equal(zeroX.allow, true);
  assert.equal(zeroX.kind, 'minor');

  const tagMinor = decide({
    author: 'dependabot[bot]',
    title: 'chore(deps): bump actions/checkout from v4 to v4.2.0',
  });
  assert.equal(tagMinor.allow, true);
  assert.equal(tagMinor.kind, 'minor');
});

test('skips single-package Dependabot semver-major updates (#1388, #1392, single-component tags, body-only)', () => {
  const workersTypes = decide({
    author: 'dependabot[bot]',
    title: 'chore(deps-dev): bump @cloudflare/workers-types from 4.20260511.1 to 5.20261120.1',
    body: 'Bumps [@cloudflare/workers-types](https://github.com/cloudflare/workerd) from 4.20260511.1 to 5.20261120.1.',
  });
  assert.equal(workersTypes.allow, false);
  assert.equal(workersTypes.kind, 'major');

  const simpleWebauthn = decide({
    author: 'dependabot[bot]',
    title: 'chore(deps): bump @simplewebauthn/server from 13.3.3 to 14.1.0',
    body: 'Bumps [@simplewebauthn/server](https://github.com/MasterKale/SimpleWebAuthn) from 13.3.3 to 14.1.0.',
  });
  assert.equal(simpleWebauthn.allow, false);
  assert.equal(simpleWebauthn.kind, 'major');

  const actionMajor = decide({
    author: 'dependabot[bot]',
    title: 'chore(deps): bump actions/download-artifact from 7 to 8',
    body: 'Bumps [actions/download-artifact](https://github.com/actions/download-artifact) from 7 to 8.',
  });
  assert.equal(actionMajor.allow, false);
  assert.equal(actionMajor.kind, 'major');

  const bodyOnlyMajor = decide({
    author: 'dependabot[bot]',
    title: 'chore(deps-dev): bump @cloudflare/workers-types',
    body: 'Bumps [@cloudflare/workers-types](https://github.com/cloudflare/workerd) from 4.20260511.1 to 5.20261120.1.\n',
  });
  assert.equal(bodyOnlyMajor.allow, false);
  assert.equal(bodyOnlyMajor.kind, 'major');
});

test('skips unknown, SHA/digest, prerelease, downgrade, and mismatched Dependabot updates (fail closed)', () => {
  const noVersions = decide({
    author: 'dependabot[bot]',
    title: 'chore(deps): update dependencies',
    body: 'Updates something without semver info.',
  });
  assert.equal(noVersions.allow, false);
  assert.equal(noVersions.kind, 'unknown');

  const shaBump = decide({
    author: 'dependabot[bot]',
    title: 'chore(deps): bump alpine from abcdef1 to 1234567',
  });
  assert.equal(shaBump.allow, false);
  assert.equal(shaBump.kind, 'unknown');

  const numericShaBump = decide({
    author: 'dependabot[bot]',
    title: 'chore(deps): bump foo from 1234567 to 8901234',
  });
  assert.equal(numericShaBump.allow, false);
  assert.equal(numericShaBump.kind, 'unknown');

  const prerelease = decide({
    author: 'dependabot[bot]',
    title: 'chore(deps): bump foo from 1.2.3 to 1.2.4-rc.1',
  });
  assert.equal(prerelease.allow, false);
  assert.equal(prerelease.kind, 'unknown');

  const downgrade = decide({
    author: 'dependabot[bot]',
    title: 'chore(deps): bump foo from 1.3.0 to 1.2.0',
  });
  assert.equal(downgrade.allow, false);
  assert.equal(downgrade.kind, 'unknown');

  const mismatch = decide({
    author: 'dependabot[bot]',
    title: 'chore(deps): bump foo from 1.2.3 to 1.2.4',
    body: 'Bumps [foo](https://example.com) from 1.2.3 to 1.3.0.',
  });
  assert.equal(mismatch.allow, false);
  assert.equal(mismatch.kind, 'unknown');
});

test('handles grouped Dependabot PRs: allows all patch/minor, rejects if any major or unknown, ignores <details>', () => {
  const groupedPatch = decide({
    author: 'dependabot[bot]',
    title: 'chore(deps): bump the npm-minor-patch group across 1 directory with 2 updates',
    body: [
      'Bumps the npm-minor-patch group with 2 updates in the / directory:',
      '',
      '| Package | From | To |',
      '| --- | --- | --- |',
      '| [hono](https://github.com/honojs/hono) | `4.13.11` | `4.13.16` |',
      '| [marked](https://github.com/markedjs/marked) | `18.2.0` | `18.2.1` |',
      '',
      '<details>',
      '<summary>Release notes</summary>',
      'Bumps [evil](https://example.com) from 1.0.0 to 2.0.0.',
      '</details>',
    ].join('\n'),
  });
  assert.equal(groupedPatch.allow, true);
  assert.equal(groupedPatch.kind, 'patch');
  assert.equal(groupedPatch.grouped, true);

  const groupedMinor = decide({
    author: 'dependabot[bot]',
    title: 'chore(deps): bump the npm-minor-patch group across 1 directory with 2 updates',
    body: [
      'Bumps the npm-minor-patch group with 2 updates in the / directory:',
      '',
      '| Package | From | To |',
      '| :--- | :--- | :--- |',
      '| [hono](https://github.com/honojs/hono) | `4.13.11` | `4.13.16` |',
      '| [eslint](https://github.com/eslint/eslint) | `10.13.0` | `10.14.0` |',
    ].join('\n'),
  });
  assert.equal(groupedMinor.allow, true);
  assert.equal(groupedMinor.kind, 'minor');
  assert.equal(groupedMinor.grouped, true);

  const groupedWithMajor = decide({
    author: 'dependabot[bot]',
    title: 'chore(deps): bump the npm-minor-patch group across 1 directory with 2 updates',
    body: [
      'Bumps the npm-minor-patch group with 2 updates in the / directory:',
      '',
      '| Package | From | To |',
      '| --- | --- | --- |',
      '| [hono](https://github.com/honojs/hono) | `4.13.11` | `4.13.16` |',
      '| [@simplewebauthn/server](https://example.com) | `13.3.3` | `14.1.0` |',
    ].join('\n'),
  });
  assert.equal(groupedWithMajor.allow, false);
  assert.equal(groupedWithMajor.kind, 'major');
  assert.equal(groupedWithMajor.grouped, true);

  const groupedWithUnknown = decide({
    author: 'dependabot[bot]',
    title: 'chore(deps): bump the docker-minor-patch group with 2 updates',
    body: [
      'Bumps the docker-minor-patch group with 2 updates:',
      '',
      '| Package | From | To |',
      '| --- | --- | --- |',
      '| [node](https://example.com) | `22.1.0` | `22.2.0` |',
      '| [alpine](https://example.com) | `sha256:aaa` | `sha256:bbb` |',
    ].join('\n'),
  });
  assert.equal(groupedWithUnknown.allow, false);
  assert.equal(groupedWithUnknown.kind, 'unknown');
  assert.equal(groupedWithUnknown.grouped, true);

  const groupedNoTable = decide({
    author: 'dependabot[bot]',
    title: 'chore(deps): bump the npm-minor-patch group across 1 directory with 2 updates',
    body: 'Bumps the npm-minor-patch group with 2 updates.',
  });
  assert.equal(groupedNoTable.allow, false);
  assert.equal(groupedNoTable.kind, 'unknown');
  assert.equal(groupedNoTable.grouped, true);
});

test('passes non-Dependabot PRs unaffected regardless of title or body', () => {
  const res = decide({
    author: 'reverb256',
    title: 'feat!: drop legacy v1 API and bump from 1 to 2',
    body: 'Manual PR from maintainer.',
  });
  assert.equal(res.allow, true);
  assert.equal(res.kind, 'non-dependabot');
  assert.equal(res.grouped, false);
});

test('Install gh always verifies sha256 into $RUNNER_TEMP/gh-pinned, exports GH, and never falls back to PATH', () => {
  const text = workflow();
  const installSection = text.slice(
    text.indexOf('- name: Install gh'),
    text.indexOf('- name: Evaluate the gate once'),
  );
  assert.ok(!installSection.includes('command -v gh'), 'Install gh must never skip based on PATH gh');
  assert.ok(!installSection.includes('GITHUB_PATH'), 'Install gh must not rely on GITHUB_PATH');
  assert.ok(installSection.includes('62ccf747115ddc61237efffdde66a3c8f70ba249433dc64f70801089b59c59c8'));
  assert.ok(installSection.includes('$RUNNER_TEMP/gh-pinned'));
  assert.ok(installSection.includes('sha256sum -c -'));
  assert.ok(installSection.includes('echo "GH=${gh_bin}" >> "$GITHUB_ENV"'));

  const evalSection = text.slice(text.indexOf('- name: Evaluate the gate once'));
  assert.ok(evalSection.includes('if [[ -z "${GH:-}" || ! -x "$GH" ]]; then'), 'Evaluate must fail closed when GH is unset/not executable');
  const bareGhLines = evalSection
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .filter((line) => /(?<!\$)\bgh\s+(?:api|pr|workflow|issue)\b/.test(line));
  assert.deepEqual(bareGhLines, [], 'Evaluate step must call "$GH", never bare gh on PATH');

  // Verify the checksum check in Install gh actually fails closed on mismatch
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-pin-check-'));
  const tarball = path.join(tmp, 'gh_2.103.2_linux_amd64.tar.gz');
  fs.writeFileSync(tarball, 'tampered-tarball');
  const check = spawnSync('bash', ['-euo', 'pipefail', '-c', 'echo "62ccf747115ddc61237efffdde66a3c8f70ba249433dc64f70801089b59c59c8  $1" | sha256sum -c -', '_', tarball], {
    encoding: 'utf8',
  });
  assert.notEqual(check.status, 0, 'checksum mismatch must fail closed');
});
