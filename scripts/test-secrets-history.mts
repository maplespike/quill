#!/usr/bin/env tsx
/**
 * Regression test for runs 37957712708 / 37957968339 (PR #1045): the
 * full-history secrets gate scanned with a bare `--log-opts=--all`, so the
 * finding set depended on WHICH CLONE ran it. The baseline was generated in
 * a clone that still resolved `origin/wt/t_2535563a` — a branch already
 * deleted upstream — while CI's checkout (fetch-depth: 0) could not fetch
 * those commits. Three baseline entries were therefore reported as findings
 * "that no longer exist in history" and the gate failed red on both runs,
 * over refs rather than over secrets.
 *
 * These cases run the REAL gate script against fixture repos, with a FAKE
 * gitleaks binary that records the scan scope and reports scope-dependent
 * findings. That pins the contract itself:
 *
 *   1. Default scope = the origin remote-tracking refs + HEAD — exactly what
 *      CI can reproduce. A never-pushed local branch must NOT widen it.
 *   2. `--all-refs` = every ref (the pre-public audit escape hatch).
 *   3. A clone with no origin refs falls back to `--all` and SAYS so.
 *   4. A baseline entry visible only to `--all` fails loud and names the
 *      ref mismatch (`git fetch --prune origin`), not a bare "history was
 *      cleaned".
 *   5. `--print-baseline` regenerates from the enforced scope only.
 *
 * Plus the 2026-10-14 incident class (runs 38612919742 / 38617463045): a
 * "WIP backup" sweep (commit fd4f6e08 on wip/atlas-backup-20261014) committed
 * the clone's untracked files wholesale — including SOPS editor temps holding
 * PLAINTEXT decrypts of secrets/runtime.yaml (live Stripe/JWT/OAuth
 * credentials) — and pushed the branch, so every main CI run failed with 34
 * un-baselined findings. Deleting the ref removed the findings; the RECURRENCE
 * hole was that git never ignored the files, so any `git add -A` sweep could
 * re-leak them. The gitignore tests pin that closure against the real
 * repository's rules, by behaviour (`git check-ignore`), not by pattern text.
 *
 * No real gitleaks binary is needed: the fake stands in for it, so the suite
 * runs on any runner with bash + git + python3.
 *
 * Runs as `tsx --test` via `pnpm run test:secrets-history` (part of `pnpm test`).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GATE = path.join(REPO, 'scripts/check-secrets-history.sh');

/** 40-hex stand-in commits mirroring the incident's real shapes. */
const ORIGIN_COMMIT = 'c1'.repeat(20);
const STALE_COMMIT = 'c2'.repeat(20);

/** Baseline rows (same `<commit>:<file>:<rule>:<line>` shape as the real file). */
const ORIGIN_ROW = `${ORIGIN_COMMIT}:.github/workflows/ci.yml:generic-api-key:53`;
const STALE_ROWS = [
  `${STALE_COMMIT}:scripts/test-image-pins.mts:generic-api-key:52`,
  `${STALE_COMMIT}:scripts/test-image-pins.mts:generic-api-key:78`,
].join('\n');

/** Finding sets the fake gitleaks reports per scan scope. */
const finding = (commit: string, file: string, line: number) => ({
  Description: 'fixture finding',
  StartLine: line,
  File: file,
  Commit: commit,
  RuleID: 'generic-api-key',
  Secret: 'redacted',
});
const ORIGIN_SET = JSON.stringify([finding(ORIGIN_COMMIT, '.github/workflows/ci.yml', 53)]);
const ALL_SET = JSON.stringify([
  finding(ORIGIN_COMMIT, '.github/workflows/ci.yml', 53),
  finding(STALE_COMMIT, 'scripts/test-image-pins.mts', 52),
  finding(STALE_COMMIT, 'scripts/test-image-pins.mts', 78),
]);

/**
 * Fake gitleaks binary. Records the `--log-opts` it was invoked with, then
 * emits the finding set that scope would really see: `--all` resolves the
 * never-pushed branch (ALL_SET), the origin-refs scope does not (ORIGIN_SET).
 */
const FAKE_GITLEAKS = `#!/usr/bin/env bash
set -euo pipefail
logopts=""
report=""
prev=""
for arg in "$@"; do
  case "$arg" in
    --log-opts=*) logopts="\${arg#--log-opts=}" ;;
    --log-opts) prev="logopts" ;;
    --report-path=*) report="\${arg#--report-path=}" ;;
    --report-path) prev="report" ;;
    *)
      case "$prev" in
        logopts) logopts="$arg"; prev="" ;;
        report)  report="$arg";  prev="" ;;
      esac
      ;;
  esac
done
printf '%s' "$logopts" > "\${FAKE_STATE_DIR}/logopts"
if [[ "$logopts" == *"--all"* ]]; then
  printf '%s' "\${FAKE_FINDINGS_ALL}" > "$report"
else
  printf '%s' "\${FAKE_FINDINGS_ORIGIN}" > "$report"
fi
exit 0
`;

type Fixture = {
  /** Rows for docs/secrets-history-baseline.txt in the fixture repo. */
  baseline: string;
  /** Set to false to build a clone with no refs/remotes/origin/* at all. */
  originRefs?: boolean;
};

type Harness = {
  /** The fixture repo root (the gate script is copied inside it). */
  root: string;
  /** State dir: the fake binary and its recorded scope live here. */
  state: string;
  /** Run the REAL gate script inside the fixture; combines stdout+stderr. */
  runGate: (args: string[]) => { status: number; out: string };
};

/** Build an isolated git repo the gate can run in, plus the fake binary. */
function buildFixture(f: Fixture): Harness {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'secrets-history-'));
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'secrets-history-state-'));

  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.copyFileSync(GATE, path.join(root, 'scripts/check-secrets-history.sh'));
  fs.writeFileSync(path.join(root, 'docs/secrets-history-baseline.txt'), `${f.baseline}\n`);

  const fake = path.join(state, 'gitleaks');
  fs.writeFileSync(fake, FAKE_GITLEAKS);
  fs.chmodSync(fake, 0o755);

  const git = (args: string[]) =>
    spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  const commit = (msg: string) => {
    fs.writeFileSync(path.join(root, 'probe.txt'), `${msg}\n`);
    git(['add', 'probe.txt']);
    git(['-c', 'user.email=ci@example.invalid', '-c', 'user.name=ci', 'commit', '-qm', msg]);
  };

  git(['init', '-q', '-b', 'main']);
  commit('fixture: on-origin history');
  if (f.originRefs !== false) {
    git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  }
  // The ref class that caused the incident: a local branch that was NEVER
  // pushed, so `--all` resolves it here but CI's clone cannot fetch it.
  git(['checkout', '-q', '-b', 'wt/never-pushed']);
  git(['commit', '-q', '--allow-empty', '-m', 'fixture: never-pushed commit']);
  git(['checkout', '-q', 'main']);

  const runGate = (args: string[]) => {
    const r = spawnSync('bash', [path.join(root, 'scripts/check-secrets-history.sh'), ...args], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        GITLEAKS_BIN: fake,
        FAKE_STATE_DIR: state,
        FAKE_FINDINGS_ALL: ALL_SET,
        FAKE_FINDINGS_ORIGIN: ORIGIN_SET,
      },
    });
    return { status: r.status ?? -1, out: (r.stdout ?? '') + (r.stderr ?? '') };
  };

  return { root, state, runGate };
}

/** The scope the fake gitleaks was last invoked with. */
function recordedScope(h: Harness): string {
  return fs.readFileSync(path.join(h.state, 'logopts'), 'utf8');
}

test('default scope is the origin refs + HEAD — never a bare --all (runs 37957712708/37957968339)', () => {
  const h = buildFixture({ baseline: ORIGIN_ROW });
  const r = h.runGate([]);
  assert.equal(r.status, 0, `gate output:\n${r.out}`);
  // The incident's failure mode, pinned from both directions:
  //   a bare --all would resolve wt/never-pushed -> the fake reports ALL_SET
  //   -> 2 findings appear that the baseline does not carry -> exit 1.
  assert.equal(recordedScope(h), '--glob=refs/remotes/origin/* HEAD');
  assert.match(r.out, /scope: --glob=refs\/remotes\/origin\/\* HEAD/);
  assert.match(r.out, /PASS — 1 full-history finding\(s\), all accounted for in the baseline/);
});

test('a baseline entry visible only to --all fails loud and names the ref mismatch first', () => {
  const h = buildFixture({ baseline: `${ORIGIN_ROW}\n${STALE_ROWS}` });
  const r = h.runGate([]);
  assert.equal(r.status, 1, 'a stale baseline entry must fail the gate, not pass blind');
  assert.match(r.out, /the baseline lists 2 finding\(s\) that no longer exist in history/);
  // The hint that would have explained the 2026-10-09 incident in one line.
  assert.match(r.out, /git fetch --prune origin/);
  assert.match(r.out, /The usual culprit is a stale/);
  assert.match(r.out, /scope this run: /);
  assert.equal(recordedScope(h), '--glob=refs/remotes/origin/* HEAD');
});

test('--all-refs scans every ref: the pre-public audit still sees the never-pushed branch', () => {
  const h = buildFixture({ baseline: `${ORIGIN_ROW}\n${STALE_ROWS}` });
  const r = h.runGate(['--all-refs']);
  assert.equal(r.status, 0, `gate output:\n${r.out}`);
  assert.equal(recordedScope(h), '--all');
  assert.match(r.out, /PASS — 3 full-history finding\(s\)/);
});

test('a clone with no origin refs falls back to --all and SAYS so', () => {
  const h = buildFixture({ baseline: `${ORIGIN_ROW}\n${STALE_ROWS}`, originRefs: false });
  const r = h.runGate([]);
  assert.equal(r.status, 0, `gate output:\n${r.out}`);
  assert.equal(recordedScope(h), '--all');
  assert.match(r.out, /no refs\/remotes\/origin\/\* — no remote fetched\? falling back to --all/);
});

test('--print-baseline regenerates from the enforced scope and names it', () => {
  const h = buildFixture({ baseline: ORIGIN_ROW });
  const r = h.runGate(['--print-baseline']);
  assert.equal(r.status, 0, `gate output:\n${r.out}`);
  // The regenerated baseline carries only what the enforced scope can see —
  // never-pushed commits must NOT leak back into it (that is how the stale
  // entries were born).
  assert.ok(r.out.includes(ORIGIN_ROW), 'the on-origin finding is enumerated');
  assert.ok(!r.out.includes(STALE_COMMIT), 'the never-pushed commit is absent');
  assert.match(r.out, /scope was: --glob=refs\/remotes\/origin\/\* HEAD/);
});

test('unknown argument exits 2 with a usage line', () => {
  const h = buildFixture({ baseline: ORIGIN_ROW });
  const r = h.runGate(['--bogus']);
  assert.equal(r.status, 2);
  assert.match(r.out, /unknown argument: --bogus/);
});

// ── 2026-10-14 incident (runs 38612919742 / 38617463045): gitignore closure ────
//
// The "WIP backup" sweep that leaked the SOPS temps worked via `git add -A`
// over untracked files. These tests fail if anyone removes the .gitignore
// rules that keep the three leaked file classes out of every future sweep.
// They check BEHAVIOUR (`git check-ignore`) against THIS repository's real
// .gitignore, so they survive pattern rewrites and never test text trivia.

/** Paths that must be ignored: the exact shapes the incident committed. */
const MUST_IGNORE = [
  // SOPS editor temps of secrets/runtime.yaml — PLAINTEXT live credentials.
  // Real names from commit fd4f6e08, wildcards pinned by behaviour not text.
  'secrets/tmp.ZMFRg0.yaml',
  'secrets/tmp.y8ns8n.yaml',
  'secrets/tmp2zgn9_f1.yaml',
  'secrets/tmp.anything.yaml',
  'secrets/tmpXYZ.yaml',
  // sops edit debris when the editor dies mid-edit.
  '.sops.yaml.tmp',
  // SBOM artifacts — local-only, nothing consumes them from git.
  'sbom/docker.io_library_quill-api_2026-10-05-b454ec90-dirty.meta',
  'sbom/anything.spdx.json',
];

/** Paths that must NOT be ignored: the encrypted/documented lane stays committable. */
const MUST_TRACK = [
  'secrets/runtime.yaml',       // SOPS-encrypted — safe to commit by design
  'secrets/runtime.yaml.example',
  'secrets/README.md',
  'docs/secrets-history-baseline.txt',
  'scripts/check-secrets-history.sh',
];

test('the SOPS-temp, sops-edit-debris and sbom classes are gitignored (fd4f6e08 incident)', () => {
  for (const p of MUST_IGNORE) {
    const r = spawnSync('git', ['check-ignore', '-q', p], { cwd: REPO, encoding: 'utf8' });
    assert.equal(
      r.status, 0,
      `git check-ignore must match ${p}: a WIP-backup sweep (git add -A) would commit it again.\n` +
      'Restore the secrets/tmp*, .sops.yaml.tmp and sbom/ rules in .gitignore.',
    );
  }
});

test('the encrypted-secrets and gate lanes are still committable (no over-broad ignore)', () => {
  for (const p of MUST_TRACK) {
    const r = spawnSync('git', ['check-ignore', '-q', p], { cwd: REPO, encoding: 'utf8' });
    assert.equal(
      r.status, 1,
      `git check-ignore must NOT match ${p}: the encrypted-secrets lane is safe to commit.\n` +
      'An ignore rule is swallowing a file that belongs in git — tighten it.',
    );
  }
});
