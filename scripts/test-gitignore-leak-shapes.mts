#!/usr/bin/env tsx
/**
 * Regression test for CI run 38617463045 / issue #1070: the 2026-10-14
 * "WIP backup (atlas)" sweep committed three plaintext decrypts of
 * secrets/runtime.yaml — secrets/tmp.ZMFRg0.yaml, secrets/tmp.y8ns8n.yaml,
 * secrets/tmp2zgn9_f1.yaml, carrying the live sk_live_ Stripe key — plus
 * .sops.yaml.tmp, sbom/ artifacts and .worktrees/ metadata, and pushed them
 * to wip/atlas-backup-20261014. The full-history secrets gate failed every
 * main run on the 34 findings (correctly).
 *
 * The branch was deleted and rotation is tracked in #1070, but the CLASS gap
 * stayed: .gitignore's decrypt-artifact rules (secrets/*.dec, *.plaintext,
 * *.env, decrypted/) never matched the mktemp shapes, because mktemp puts
 * its random suffix mid-name (tmp.<rand>.yaml, tmp<rand>.yaml). #1070 item 7
 * claimed ".gitignore now covers the leaked classes" — it did not, on main.
 * The sweep's trigger is unidentified (#1070 item 6) and the plaintext temps
 * are still on the atlas disk, so a recurrence re-commits the same files
 * unless the ignore rules bite.
 *
 * This suite drives the REAL `git check-ignore` against the repo's REAL
 * .gitignore, so it pins the actual behaviour, not a copy of the rules:
 *
 *   1. every path shape from the incident commit is ignored;
 *   2. mktemp suffix variants (bare, dotted, no-dot) and .tmp-staged
 *      decrypts are ignored;
 *   3. sealed SOPS files stay committable — over-matching would silently
 *      break the SOPS model (encrypted *.yaml ARE safe to commit);
 *   4. the harness itself is proven able to fail: a path the .gitignore
 *      does not cover must come back non-ignored.
 *
 * Runs as `tsx --test` via `pnpm run test:gitignore` (part of `pnpm test`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Run `git check-ignore` against the repo's real .gitignore for one path.
 * Returns true when git reports the path as ignored.
 *
 * --no-index keeps the verdict independent of whatever is staged right now;
 * paths that do not exist on disk are fine, check-ignore matches on shape.
 */
function isIgnored(relPath: string): boolean {
  const r = spawnSync(
    'git',
    ['check-ignore', '--no-index', '--quiet', '--', relPath],
    { cwd: REPO, encoding: 'utf8' },
  );
  // exit 0: ignored. exit 1: not ignored. anything else: git itself failed.
  if (r.status !== 0 && r.status !== 1) {
    assert.fail(
      `git check-ignore could not run for ${relPath} (status ${r.status}): ` +
        `${r.stderr || r.stdout}`,
    );
  }
  return r.status === 0;
}

/** The exact paths the atlas backup commit (fd4f6e08) carried to the remote. */
const INCIDENT_PATHS: Array<[string, string]> = [
  ['secrets/tmp.ZMFRg0.yaml', 'mktemp dot-suffix decrypt of secrets/runtime.yaml'],
  ['secrets/tmp.y8ns8n.yaml', 'mktemp dot-suffix decrypt of secrets/runtime.yaml'],
  ['secrets/tmp2zgn9_f1.yaml', 'mktemp no-dot-suffix decrypt of secrets/runtime.yaml'],
  ['.sops.yaml.tmp', 'SOPS creation-rule editor temp'],
  ['sbom/docker.io_library_quill-api_2026-10-05-b454ec90-dirty.meta', 'generated SBOM metadata'],
  ['.worktrees/t_01fbdff5', 'agent worktree bookkeeping file'],
];

test('every path shape from the atlas backup leak (run 38617463045, fd4f6e08) is ignored', () => {
  for (const [relPath, what] of INCIDENT_PATHS) {
    assert.ok(isIgnored(relPath), `${relPath} (${what}) must be ignored — ` +
      `a recurrence of the #1070 sweep would commit it again`);
  }
});

test('mktemp and .tmp decrypt variants are ignored', () => {
  const variants: Array<[string, string]> = [
    ['secrets/tmpXXXXXX', 'bare mktemp (mktemp secrets/tmpXXXXXX)'],
    ['secrets/tmp.ABCDEFGH.yaml', 'mktemp with .yaml suffix'],
    ['secrets/tmpq7Xz2K.yaml', 'another mktemp random suffix'],
    ['secrets/runtime.yaml.tmp', 'decrypt staged as <sealed-name>.tmp'],
    ['secrets/mydecrypt.tmp', 'pipeline temp under secrets/'],
    ['secrets/decrypted/runtime.yaml', 'existing decrypted/ rule still bites'],
    ['secrets/runtime.dec', 'existing *.dec rule still bites'],
    ['secrets/runtime.plaintext', 'existing *.plaintext rule still bites'],
  ];
  for (const [relPath, what] of variants) {
    assert.ok(isIgnored(relPath), `${relPath} (${what}) must be ignored`);
  }
});

test('sealed SOPS files stay committable — the rules must not over-match', () => {
  const mustTrack: Array<[string, string]> = [
    ['secrets/runtime.yaml', 'SOPS-sealed runtime secrets (safe to commit by design)'],
    ['secrets/billing.yaml', 'SOPS-sealed billing secrets'],
    ['secrets/runtime.yaml.example', 'plaintext template'],
    ['secrets/README.md', 'workflow documentation'],
    ['secrets/SECRETSPEC-CONTRACT.md', 'spec documentation'],
  ];
  for (const [relPath, what] of mustTrack) {
    assert.ok(!isIgnored(relPath), `${relPath} (${what}) must NOT be ignored — ` +
      `over-matching breaks the SOPS model (encrypted yaml ARE safe to commit)`);
  }
});

test('harness negative control: a known-trackable path reads as non-ignored', () => {
  // If this ever "passes" as ignored, the harness is vacuous: every
  // isIgnored() true above would be meaningless too.
  assert.ok(!isIgnored('docs/secrets-history-baseline.txt'),
    'docs/secrets-history-baseline.txt is tracked on main; if check-ignore ' +
    'reports it ignored, this harness is not reading the real .gitignore');
});
