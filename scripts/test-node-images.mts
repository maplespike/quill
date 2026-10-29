#!/usr/bin/env tsx
/**
 * Eligible-node image distribution.
 *
 * imagePullPolicy is Never. After the nexus|sentry-agent affinity change,
 * a digest that exists only on nexus leaves the other replica at
 * ErrImageNeverPull (quill-portal on sentry-agent, 2026-10-29). The old
 * pin-images default copied the tarball to forge, which must not run these
 * pods.
 *
 * CI cannot read the node stores. It checks the plan: heavy hosts are
 * nexus and sentry-agent, every pinned digest is named, and deploy-prod
 * runs the store check before it commits the pin.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { ELIGIBLE_NEVER_HOSTS } from './gates/check-image-pins.mjs';
import { parseHeavyHosts, peersOf, pinnedRefs, plan, validateHeavyHosts } from './gates/check-node-images.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VALUES = path.join(REPO, 'charts/quill/values-prod.yaml');
const PIN = path.join(REPO, 'scripts/pin-images.sh');
const DEPLOY = path.join(REPO, '.github/workflows/deploy-prod.yml');
const GATE = path.join(REPO, 'scripts/gates/check-node-images.mjs');

const text = fs.readFileSync(VALUES, 'utf8');

test('heavy hosts are exactly the Never-pull nodes, and forge is absent', () => {
  const hosts = parseHeavyHosts(text);
  assert.deepEqual(validateHeavyHosts(hosts), []);
  assert.deepEqual(hosts, [...ELIGIBLE_NEVER_HOSTS]);
  assert.deepEqual(peersOf(hosts, 'nexus'), ['sentry-agent']);
  assert.ok(!hosts.includes('forge'));
});

test('every pinned quill digest is part of the distribution plan', () => {
  const refs = pinnedRefs(text);
  const svcs = refs.map((item) => item.svc);
  for (const svc of ['api', 'mcp', 'portal', 'ingest', 'search']) {
    assert.ok(svcs.includes(svc), `images.${svc} must be distributed`);
  }
  for (const item of refs) {
    assert.match(item.ref, new RegExp(`^docker\\.io/library/quill-${item.svc}@sha256:[0-9a-f]{64}$`));
  }
  assert.deepEqual(plan(text).violations, []);
});

test('a heavy host list that includes forge is rejected', () => {
  const bad = text.replace(
    /affinityHosts: &quillHeavyHosts\n((?:  - .+\n)+)/,
    'affinityHosts: &quillHeavyHosts\n  - nexus\n  - sentry-agent\n  - forge\n',
  );
  const violations = validateHeavyHosts(parseHeavyHosts(bad));
  assert.ok(violations.some((line) => /forge/.test(line)));
});

test('--peers-of nexus prints sentry-agent and --refs can skip rebuilt services', () => {
  const peers = spawnSync('node', [GATE, '--values', VALUES, '--peers-of', 'nexus'], { encoding: 'utf8' });
  assert.equal(peers.status, 0, peers.stderr);
  assert.equal(peers.stdout.trim(), 'sentry-agent');

  const refs = spawnSync('node', [GATE, '--values', VALUES, '--refs', '--except', 'api mcp portal ingest'], { encoding: 'utf8' });
  assert.equal(refs.status, 0, refs.stderr);
  const lines = refs.stdout.trim().split('\n').filter(Boolean);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^docker\.io\/library\/quill-search@sha256:[0-9a-f]{64}$/);
});

test('pin-images does not default the peer copy to forge', () => {
  const src = fs.readFileSync(PIN, 'utf8');
  assert.equal(/SYNC_NODES="\$\{QUILL_IMAGE_SYNC_NODES-forge\}"/.test(src), false);
  assert.match(src, /--peers-of/);
  assert.match(src, /distribute_ref/);
  assert.doesNotMatch(src, /SYNC_NODES="forge"/);
});

test('deploy-prod checks both eligible stores before it commits the pin', () => {
  const src = fs.readFileSync(DEPLOY, 'utf8');
  const check = src.indexOf('check-node-images.mjs --values charts/quill/values-prod.yaml --check');
  const commit = src.indexOf('name: Commit and push the pins');
  assert.ok(check > 0, 'deploy-prod must run check-node-images.mjs --check');
  assert.ok(commit > check, 'the store check must run before the pin commit');
  assert.doesNotMatch(src, /QUILL_IMAGE_SYNC_NODES=forge/);
});
