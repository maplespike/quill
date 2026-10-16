#!/usr/bin/env tsx
/**
 * Regression test for the "Deploy Docs to GitHub Pages" red-on-main class
 * (issue #1086, run 38768479350).
 *
 * `actions/configure-pages` dies with "Get Pages site failed ... Not Found"
 * when the repository has no Pages site. This repo cannot enable one today
 * (private repo on the free org plan — `POST /repos/{repo}/pages` is refused
 * with 422 "Your current plan does not support GitHub Pages for this
 * repository", verified with an org-owner token), so the workflow went red
 * on EVERY docs/portal push — 38 failures, 0 successes since June 2026 —
 * while its build steps were green every time. The red run signalled a code
 * failure the repo could not fix and hid the build signal it could still
 * give.
 *
 * The fix gates the three deploy steps on scripts/gates/pages-probe.sh:
 * verdict=enabled deploys, verdict=not-enabled skips ONLY the deploy with a
 * loud warning (green run), verdict=error (or no verdict) fails loud. This
 * lane pins both halves of that contract:
 *
 *   1. The probe script's exit/output contract, executed for real against
 *      a stubbed `gh`: enabled (rc 0), not-enabled (rc 3, the live 404
 *      stderr shape captured 2026-10-15: `gh: Not Found (HTTP 404)`), error
 *      (rc 1) — plus every fail-closed precondition (no token, no gh, no
 *      repo) and the crash case: a script that dies WITHOUT a verdict must
 *      be read by the workflow as an error, never as "not-enabled".
 *   2. The workflow wiring: the probe step exists with GH_TOKEN in scope
 *      (check-workflow-gh-auth class), and every deploy step is gated on the
 *      verdict — so the gating cannot be silently dropped in a refactor.
 *
 * Runs as `tsx --test` via `pnpm run test:pages-gating` (part of `pnpm test`)
 * and as a CI step in .github/workflows/ci.yml.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROBE = path.join(REPO, 'scripts/gates/pages-probe.sh');
const WORKFLOW = path.join(REPO, '.github/workflows/deploy-docs.yml');

// The probe must run with PATH=stubdir (see runProbe), so bash itself cannot
// be resolved by the child PATH — resolve it absolutely here, with the
// parent's normal PATH, before any env is stripped.
const BASH = execFileSync('/bin/sh', ['-c', 'command -v bash'], { encoding: 'utf8' }).trim() || '/usr/bin/bash';

/** Run the probe with a controllable environment and a stubbed `gh`. */
function runProbe(opts: {
  ghExit?: number; // stubbed gh's exit code
  ghStderr?: string; // stubbed gh's stderr text
  ghMissing?: boolean; // omit the stub from PATH entirely
  token?: string | null; // GH_TOKEN value; null omits the variable
  repo?: string | null; // GH_REPO value; null omits the variable
}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-probe-test-'));
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  if (!opts.ghMissing) {
    const stub = [
      // Absolute shebang: under PATH=stubdir, `env` cannot resolve `bash`
      // for the stub either (rc 127, the class the rc-0/rc-1 tests below
      // would otherwise misreport as probe failures).
      `#!${BASH}`,
      `printf '%s' ${JSON.stringify(opts.ghStderr ?? '')} >&2`,
      `exit ${opts.ghExit ?? 0}`,
      '',
    ].join('\n');
    fs.writeFileSync(path.join(bin, 'gh'), stub, { mode: 0o755 });
  }
  const out = path.join(tmp, 'github-output');
  // PATH is ONLY the stub dir: the system gh (and grep) must not leak in —
  // the "no gh on PATH" case would otherwise probe the live API with a fake
  // token, and an external grep would mask the probe's PATH independence.
  const env: Record<string, string> = {
    ...process.env,
    PATH: bin,
    GITHUB_OUTPUT: out,
    GITHUB_TOKEN: '',
    GH_TOKEN: '',
    GH_REPO: '',
  } as Record<string, string>;
  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  delete env.GH_REPO;
  if (opts.token !== null) env.GH_TOKEN = opts.token ?? 'stub-token';
  if (opts.repo !== null) env.GH_REPO = opts.repo ?? 'maplespike/quill';

  const res = spawnSync(BASH, [PROBE], { encoding: 'utf8', env });
  const emitted = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  fs.rmSync(tmp, { recursive: true, force: true });
  return {
    status: res.status,
    stdout: res.stdout,
    stderr: res.stderr,
    emitted,
  };
}

// ── 1. Probe verdict contract ─────────────────────────────────────────────

test('pages exists (gh rc 0) → exit 0, verdict=enabled, deploy-possible wording', () => {
  const r = runProbe({ ghExit: 0, ghStderr: '' });
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.emitted, /^verdict=enabled\n$/m);
  assert.match(r.stdout, /deploy is possible/);
});

test('404 (the live free-plan shape) → exit 3, verdict=not-enabled', () => {
  // Exact stderr captured from the real CLI on 2026-10-15:
  //   $ gh api repos/maplespike/quill/pages ; echo $?
  //   gh: Not Found (HTTP 404)
  const r = runProbe({ ghExit: 1, ghStderr: 'gh: Not Found (HTTP 404)' });
  assert.equal(r.status, 3);
  assert.match(r.emitted, /^verdict=not-enabled\n$/m);
  assert.match(r.stdout, /not enabled/);
});

test('401 bad credentials → exit 1, verdict=error (never skip)', () => {
  const r = runProbe({ ghExit: 1, ghStderr: 'gh: Bad credentials (HTTP 401)' });
  assert.equal(r.status, 1);
  assert.match(r.emitted, /^verdict=error\n$/m);
  assert.match(r.stderr, /gh api exited 1/);
});

test('422 plan refusal on GET is an error, not the skip (only 404 skips)', () => {
  // POST /pages returns 422 "Your current plan does not support GitHub Pages
  // for this repository." If GET ever 422s, that is NOT the not-enabled skip.
  const r = runProbe({
    ghExit: 1,
    ghStderr: 'gh: Your current plan does not support GitHub Pages for this repository. (HTTP 422)',
  });
  assert.equal(r.status, 1);
  assert.match(r.emitted, /^verdict=error\n$/m);
});

test('gh crash without stderr → exit 1, verdict=error', () => {
  const r = runProbe({ ghExit: 2, ghStderr: '' });
  assert.equal(r.status, 1);
  assert.match(r.emitted, /^verdict=error\n$/m);
});

test('no token → exit 1, verdict=error, refuses to guess', () => {
  const r = runProbe({ ghExit: 0, token: null });
  assert.equal(r.status, 1);
  assert.match(r.emitted, /^verdict=error\n$/m);
  assert.match(r.stderr, /GH_TOKEN/);
});

test('no gh on PATH → exit 1, verdict=error', () => {
  const r = runProbe({ ghMissing: true });
  assert.equal(r.status, 1);
  assert.match(r.emitted, /^verdict=error\n$/m);
  assert.match(r.stderr, /gh is not on PATH/);
});

test('no GH_REPO → exit 1, verdict=error', () => {
  const r = runProbe({ ghExit: 0, repo: null });
  assert.equal(r.status, 1);
  assert.match(r.emitted, /^verdict=error\n$/m);
  assert.match(r.stderr, /GH_REPO/);
});

test('GITHUB_TOKEN satisfies the token precondition too', () => {
  // The workflow passes GH_TOKEN, but the script must accept either name —
  // copy-pasted into another workflow that only sets GITHUB_TOKEN it must
  // still probe, not exit 1.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-probe-test-'));
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(
    path.join(bin, 'gh'),
    `#!${BASH}\nexit 0\n`,
    { mode: 0o755 },
  );
  const out = path.join(tmp, 'github-output');
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    GITHUB_OUTPUT: out,
    GH_REPO: 'maplespike/quill',
  } as Record<string, string>;
  delete (env as Record<string, string | undefined>).GH_TOKEN;
  delete (env as Record<string, string | undefined>).GITHUB_TOKEN;
  env.GITHUB_TOKEN = 'stub-token';
  const res = spawnSync(BASH, [PROBE], { encoding: 'utf8', env });
  const emitted = fs.readFileSync(out, 'utf8');
  fs.rmSync(tmp, { recursive: true, force: true });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(emitted, /^verdict=enabled\n$/m);
});

// ── 2. Workflow wiring (the gating cannot be silently dropped) ────────────

const wf = fs.readFileSync(WORKFLOW, 'utf8');

test('deploy-docs.yml runs the probe with a per-run token in scope (#909 class)', () => {
  // The [self-hosted, nixos] pool mixes hosts with and without stored gh
  // credentials — ambient auth passes or fails by runner luck. The probe
  // step must mint its own token.
  const probeStep = wf.match(
    /- name: Probe GitHub Pages availability[\s\S]*?run: bash scripts\/gates\/pages-probe\.sh/,
  );
  assert.ok(probeStep, 'deploy-docs.yml must run scripts/gates/pages-probe.sh');
  assert.match(probeStep[0], /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(probeStep[0], /GH_REPO: \$\{\{ github\.repository \}\}/);
  assert.match(probeStep[0], /continue-on-error: true/);
});

test('every deploy step is gated on verdict=enabled', () => {
  for (const action of [
    'actions/configure-pages@v5',
    'actions/upload-pages-artifact@v3',
    'actions/deploy-pages@v4',
  ]) {
    // A step block is "- name:" at 6-space indent through the next
    // 6-space-indent "- name:" (or EOF). `uses:` sits inside it.
    const step = wf.match(
      new RegExp(
        `^      - name: [^\\n]*\\n(?: {7,}\\S[^\\n]*\\n|\\s*\\n)*?^ {8}uses: ${action.replace(/[.@]/g, (c) => `\\${c}`)}$`,
        'm',
      ),
    );
    assert.ok(step, `deploy-docs.yml must still use ${action}`);
    assert.match(
      step[0],
      /if: steps\.pages-probe\.outputs\.verdict == 'enabled'/,
      `${action} must be gated on the probe verdict — an ungated deploy step is exactly the always-red state of run 38768479350`,
    );
  }
});

test('fail-closed step: no verdict fails the job instead of skipping the deploy', () => {
  assert.match(wf, /Fail loud on probe error/);
  assert.match(
    wf,
    /if: steps\.pages-probe\.outputs\.verdict != 'enabled' && steps\.pages-probe\.outputs\.verdict != 'not-enabled'/,
  );
});

test('not-enabled path skips ONLY the deploy, loudly (build stays verified)', () => {
  const step = wf.match(/- name: Skip Pages deploy \(not enabled on this plan\)[\s\S]*?(?=\n      - name:)/);
  assert.ok(step, 'deploy-docs.yml must keep the not-enabled skip step');
  assert.match(step[0], /if: steps\.pages-probe\.outputs\.verdict == 'not-enabled'/);
  assert.match(step[0], /::warning::/);
});
