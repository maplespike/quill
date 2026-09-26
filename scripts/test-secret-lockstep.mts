#!/usr/bin/env tsx
/**
 * Regression test for scripts/check-secret-lockstep.sh — the sops-sync gate.
 *
 * Two incident classes are locked down here:
 *
 *   1. 2026-08-15 — key-name drift. The sync script emitted uppercase
 *      JWT_SECRET/QUILL_BILLING_SECRET while every deployment referenced
 *      lowercase jwt-secret/quill-billing-secret: pods crash-looped on
 *      "JWT_SECRET must be set in production" for two incident rounds.
 *
 *   2. 2026-09-22 — the gate itself died silently. The sync script was rewritten
 *      around a MAPPING table while the check kept grepping for the old
 *      `"key=${VAR}"` shape; under `set -e` the no-match grep exited 1 with NO
 *      output, so CI reported "Secret key lockstep check failed" with nothing to
 *      diagnose. The gate must fail LOUDLY (exit 2 + a message) when it cannot
 *      evaluate, and exit 1 with the offending pair when keys really drift.
 *
 * Runs as `tsx --test` via `pnpm run test:secret-lockstep` (part of `pnpm test`)
 * and as its own step in .github/workflows/ci.yml.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = path.join(REPO, 'scripts/check-secret-lockstep.sh');

const SYNC_OK = [
  '#!/usr/bin/env bash',
  'MAPPING=(',
  '  "JWT_SECRET|quill-secrets|jwtSecret"',
  '  "QUILL_PII_HASH_SECRET|maplespike-secrets|pii-hash-secret"',
  ')',
  '',
].join('\n');

/** The pre-2026-09-22 shape: `apply_secret <secret> "key=${VAR}"` calls. */
const SYNC_LEGACY_SHAPE = [
  '#!/usr/bin/env bash',
  'apply_secret quill-secrets "jwtSecret=${JWT_SECRET}"',
  '',
].join('\n');

const MANIFEST_OK = [
  'apiVersion: apps/v1',
  'kind: Deployment',
  'metadata:',
  '  name: quill-api',
  'spec:',
  '  template:',
  '    spec:',
  '      containers:',
  '      - name: api',
  '        env:',
  '        - name: JWT_SECRET',
  '          valueFrom:',
  '            secretKeyRef:',
  '              key: jwtSecret',
  '              name: quill-secrets',
  '              optional: true',
  '',
].join('\n');

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

/** Render a throwaway repo skeleton and run the real gate against it. */
function runCheck(opts: { sync?: string; manifest?: string; nix?: string } = {}): RunResult {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lockstep-'));
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'k8s/maplespike'), { recursive: true });
  fs.mkdirSync(path.join(root, 'nix'), { recursive: true });
  fs.copyFileSync(CHECK, path.join(root, 'scripts/check-secret-lockstep.sh'));
  fs.writeFileSync(path.join(root, 'scripts/sops-sync-k8s.sh'), opts.sync ?? SYNC_OK);
  fs.writeFileSync(path.join(root, 'k8s/maplespike/quill-api-deployment.yaml'), opts.manifest ?? MANIFEST_OK);
  fs.writeFileSync(path.join(root, 'nix/saas-manifests.nix'), opts.nix ?? '');
  const r = spawnSync('bash', [path.join(root, 'scripts/check-secret-lockstep.sh')], { encoding: 'utf8' });
  fs.rmSync(root, { recursive: true, force: true });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

test('the repository manifests are in lockstep with sops-sync-k8s.sh', () => {
  const r = spawnSync('bash', [CHECK], { cwd: REPO, encoding: 'utf8' });
  assert.equal(r.status, 0, `gate failed:\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /✓ secret lockstep: \d+ referenced pair\(s\) all emitted/);
});

test('a stale extraction pattern fails loudly instead of silently (2026-09-22)', () => {
  // The sync script no longer contains MAPPING rows in the old `key=${VAR}`
  // shape. The gate must say so — the historical bug was exit 1 with no output.
  const r = runCheck({ sync: SYNC_LEGACY_SHAPE });
  assert.equal(r.status, 2, `expected a loud evaluation failure, got status ${r.status}`);
  const combined = r.stdout + r.stderr;
  assert.notEqual(combined.trim(), '', 'the gate must never fail with empty output');
  assert.match(combined, /MAPPING|extraction pattern is stale/);
});

test('a referenced pair the sync script never emits is reported as drift (2026-08-15)', () => {
  const manifest = MANIFEST_OK.replace('key: jwtSecret', 'key: jwt-secret');
  const r = runCheck({ manifest });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /quill-secrets\/jwt-secret is referenced but sops-sync-k8s\.sh never emits it/);
  assert.match(r.stdout, /k8s\/maplespike\/quill-api-deployment\.yaml/, 'the offending file must be named');
});

test('a reference to a secret the sync script does not own is skipped, not failed', () => {
  const manifest = [
    MANIFEST_OK.trimEnd(),
    '        - name: POSTGRES_USER',
    '          valueFrom:',
    '            secretKeyRef:',
    '              name: quill-db-secret',
    '              key: postgres-user',
    '',
  ].join('\n');
  const r = runCheck({ manifest });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /skipped quill-db-secret\/postgres-user/);
  assert.match(r.stdout, /1 unmanaged skipped/);
});

test('a new unmanaged secret is not silently ignored — it must be declared', () => {
  const manifest = MANIFEST_OK.replace('name: quill-secrets', 'name: mystery-secrets');
  const r = runCheck({ manifest });
  assert.equal(r.status, 1, 'an undeclared secret name must fail closed');
  assert.match(r.stdout, /mystery-secrets\/jwtSecret is referenced but sops-sync-k8s\.sh never emits it/);
});

test('the nix ${secretsRef} parameter resolves to the prod secret name', () => {
  const nixOk = [
    '            - name: QUILL_PII_HASH_SECRET',
    '              valueFrom:',
    '                secretKeyRef:',
    '                  name: ${secretsRef}',
    '                  key: pii-hash-secret',
    '                  optional: true',
    '',
  ].join('\n');
  const ok = runCheck({ nix: nixOk });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);

  // Same indirection, drifted key: the gate must resolve ${secretsRef} to
  // maplespike-secrets and report the mismatch rather than ignoring the block.
  const nixDrift = nixOk.replace('key: pii-hash-secret', 'key: jwt-secret');
  const drift = runCheck({ nix: nixDrift });
  assert.equal(drift.status, 1);
  assert.match(drift.stdout, /maplespike-secrets\/jwt-secret is referenced but sops-sync-k8s\.sh never emits it/);
});

test('an empty manifest source is an evaluation failure, not a clean pass', () => {
  const r = runCheck({ manifest: '', nix: '' });
  assert.equal(r.status, 2, 'zero extracted references must not pass as "all in lockstep"');
  assert.match(r.stdout + r.stderr, /extraction pattern is stale/);
});
