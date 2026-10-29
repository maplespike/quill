#!/usr/bin/env tsx
/**
 * In-cluster registry image plan.
 *
 * Images are pushed to registry.registry.svc.cluster.local:5000 and pulled
 * with imagePullPolicy IfNotPresent. CI cannot reach the registry. It checks
 * the plan: registry host, quill/<svc>@sha256 digest form, no Never, no ssh,
 * and deploy-prod queries the manifest API before the pin commit.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  REGISTRY_HOST,
  digestsToDelete,
  parseRegistryEndpoint,
  plan,
} from './gates/check-node-images.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VALUES = path.join(REPO, 'charts/quill/values-prod.yaml');
const PIN = path.join(REPO, 'scripts/pin-images.sh');
const GATE_SRC = path.join(REPO, 'scripts/gates/check-node-images.mjs');
const DEPLOY = path.join(REPO, '.github/workflows/deploy-prod.yml');
const GATE = path.join(REPO, 'scripts/gates/check-node-images.mjs');

const text = fs.readFileSync(VALUES, 'utf8');

test('production values name the in-cluster registry and IfNotPresent', () => {
  const planned = plan(text);
  assert.deepEqual(planned.violations, []);
  assert.equal(planned.registry, REGISTRY_HOST);
  assert.equal(planned.pullPolicy, 'IfNotPresent');
  const svcs = planned.refs.map((item) => item.svc);
  for (const svc of ['api', 'mcp', 'portal', 'ingest', 'search']) {
    assert.ok(svcs.includes(svc), `images.${svc} must be in the plan`);
  }
  for (const item of planned.refs) {
    assert.equal(item.ref, `${REGISTRY_HOST}/quill/${item.svc}@${item.digest}`);
    assert.match(item.digest, /^sha256:[0-9a-f]{64}$/);
  }
});

test('a Never pull policy is rejected', () => {
  const bad = text.replace('pullPolicy: IfNotPresent', 'pullPolicy: Never');
  const violations = plan(bad).violations;
  assert.ok(violations.some((line) => /IfNotPresent|Never/.test(line)));
});

test('registries.yaml endpoint is the plain-HTTP ClusterIP, else the host', () => {
  const yaml = [
    'mirrors:',
    '  "registry.registry.svc.cluster.local:5000":',
    '    endpoint:',
    '      - "http://10.43.12.34:5000"',
    'configs:',
    '  "registry.registry.svc.cluster.local:5000":',
    '    tls:',
    '      insecure_skip_verify: true',
  ].join('\n');
  assert.equal(parseRegistryEndpoint(yaml), 'http://10.43.12.34:5000');
  assert.equal(parseRegistryEndpoint(''), `http://${REGISTRY_HOST}`);
});

test('prune keeps the pinned digest and the 5 newest tags', () => {
  const entries = [
    { tag: 'new', digest: 'sha256:' + 'a'.repeat(64), time: 50 },
    { tag: 't4', digest: 'sha256:' + 'b'.repeat(64), time: 40 },
    { tag: 't3', digest: 'sha256:' + 'c'.repeat(64), time: 30 },
    { tag: 't2', digest: 'sha256:' + 'd'.repeat(64), time: 20 },
    { tag: 't1', digest: 'sha256:' + 'e'.repeat(64), time: 10 },
    { tag: 'old', digest: 'sha256:' + 'f'.repeat(64), time: 5 },
    { tag: 'pinned-old', digest: 'sha256:' + '1'.repeat(64), time: 1 },
  ];
  const pinned = 'sha256:' + '1'.repeat(64);
  const drop = digestsToDelete(entries, pinned, 5);
  assert.deepEqual(drop, ['sha256:' + 'f'.repeat(64)]);
  assert.ok(!drop.includes(pinned));
  assert.ok(!drop.includes('sha256:' + 'a'.repeat(64)));
});

test('pin-images and the registry check do not ssh', () => {
  const pin = fs.readFileSync(PIN, 'utf8');
  const gate = fs.readFileSync(GATE_SRC, 'utf8');
  assert.doesNotMatch(pin, /\bssh\b/);
  assert.doesNotMatch(gate, /\bssh\b/);
  assert.match(pin, /ctr images push --plain-http/);
  assert.match(pin, /quill-search/);
  assert.doesNotMatch(pin, /QUILL_IMAGE_SYNC_NODES/);
});

test('deploy-prod checks the registry and prunes before the pin commit', () => {
  const src = fs.readFileSync(DEPLOY, 'utf8');
  const check = src.indexOf('check-node-images.mjs --values charts/quill/values-prod.yaml --check');
  const prune = src.indexOf('check-node-images.mjs --values charts/quill/values-prod.yaml --prune --keep 5');
  const commit = src.indexOf('name: Commit and push the pins');
  assert.ok(check > 0, 'deploy-prod must query the registry');
  assert.ok(prune > check, 'prune runs after the digest check');
  assert.ok(commit > prune, 'the pin commit waits until the registry matches');
  assert.doesNotMatch(src, /\bssh\b/);
});

test('--plan exits 0 on values-prod', () => {
  const result = spawnSync('node', [GATE, '--values', VALUES], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /registry plan: OK/);
  assert.match(result.stdout, new RegExp(REGISTRY_HOST.replace(/\./g, '\\.')));
});
