#!/usr/bin/env tsx
/**
 * Regression test for gate A3-IMAGEPIN (#755) — image pins must be immutable.
 *
 * The 2026-08-13 -> 2026-09-21 production state pinned every workload to the
 * mutable tag `docker.io/library/quill-*:local` with `imagePullPolicy: Never`:
 * a rebuilt image could silently re-point the same tag (stale layers served),
 * and nothing in git said which build was live. Two failure modes are locked
 * down here:
 *
 *   1. A mutable tag (`:local`, `:latest`, `:stable`, …) reappearing in the
 *      rendered manifests or in charts/quill/values-prod.yaml.
 *   2. A `Never`-pulled container with no node pin — the containerd store is
 *      per node, so a reschedule onto another node dies with ErrImageNeverPull
 *      (reproduced live on sentry-agent during the fix).
 *
 * Runs as `tsx --test` via `pnpm run test:pins` (part of `pnpm test`).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  classifyRef,
  checkRefs,
  checkProdValues,
  checkNodePins,
  checkTemplates,
  extractImageRefs,
  parseImagesBlock,
  QUILL_SERVICES,
} from './gates/check-image-pins.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VALUES_PROD = path.join(REPO, 'charts/quill/values-prod.yaml');
const TEMPLATES = path.join(REPO, 'charts/quill/templates');
const DIGEST = 'sha256:' + 'a1'.repeat(32);

test('classifyRef rejects every mutable form that caused #755', () => {
  for (const tag of ['local', 'latest', 'stable', 'main', 'prod', 'dev']) {
    const c = classifyRef(`docker.io/library/quill-api:${tag}`);
    assert.equal(c.ok, false, `:${tag} must be rejected`);
    assert.equal(c.kind, 'mutable');
  }
  assert.equal(classifyRef('docker.io/library/quill-api').ok, false, 'a tagless ref is unpinned');
  assert.equal(classifyRef(`docker.io/library/quill-api@${DIGEST}`).ok, true);
  assert.equal(classifyRef('docker.io/library/postgres:17-alpine').ok, true);
  assert.equal(classifyRef('docker.io/cloudflare/cloudflared:2026.8.2').ok, true);
  assert.equal(classifyRef('docker.io/library/quill-api:2026-09-21-sha.aa7a2c64b55d').ok, true);
});

test('classifyRef rejects a malformed digest', () => {
  const c = classifyRef('docker.io/library/quill-api@sha256:not-a-digest');
  assert.equal(c.ok, false);
  assert.equal(c.kind, 'digest');
});

// Regression: 2026-10-06, CI run 37408574389 (SHA 31f810d7). Commit bfe587bb
// pinned `images.ingest.tag: '2026-10-05'` — a date with no build suffix. The
// operator gate (check-image-pins.mjs) called it OK because IMMUTABLE_TAG_RE's
// version alternative matched `2026` + `-10-05` like `v1-2-3`; CI's build-tag
// regex (this file, "the production values file pins every quill workload to
// a digest") rejected it and the build went red. The gate must catch what CI
// catches: a bare date is not a version pin and not a build tag.
test('classifyRef rejects a date-only tag — the bfe587bb false green (run 37408574389)', () => {
  const c = classifyRef('docker.io/library/quill-ingest:2026-10-05');
  assert.equal(c.ok, false, 'a date-only tag must never be accepted');
  assert.equal(c.kind, 'unpinned');
  for (const dateish of ['2026-10-5', '2026-1-05', '2026-1-5', '2026-10', '2026-1', 'v2026-10-05', '1999-01-01']) {
    const d = classifyRef(`docker.io/library/quill-ingest:${dateish}`);
    assert.equal(d.ok, false, `:${dateish} must be rejected (no date shape may pass as a version)`);
    assert.equal(d.kind, 'unpinned');
  }
  // The version alternative still accepts real upstream pins.
  assert.equal(classifyRef('docker.io/library/postgres:17-alpine').ok, true);
  assert.equal(classifyRef('docker.io/library/redis:8.2.3-alpine').ok, true);
  assert.equal(classifyRef('docker.io/cloudflare/cloudflared:2026.8.2').ok, true);
  assert.equal(classifyRef('docker.io/some/app:v1.2.3-rc1').ok, true);
  // The date-stamped build-tag shape CI enforces stays accepted (suffix mandatory).
  assert.equal(classifyRef('docker.io/library/quill-ingest:2026-10-06-f34547a9-dirty').ok, true);
});

// Regression: 2026-09-22. `image.tag: ""` in values-prod made the ingestion
// CronJobs render `docker.io/library/quill-ingest:` — an invalid reference, so
// every ingest pod died with `InvalidImageName: invalid reference format`. The
// ingest image is part of the pinned set precisely so no chart-wide tag can
// leave it blank.
test('classifyRef rejects an empty tag (the ingest CronJob InvalidImageName bug)', () => {
  const c = classifyRef('docker.io/library/quill-ingest:');
  assert.equal(c.ok, false, 'an empty tag must never be accepted');
  assert.notEqual(c.kind, 'digest');
});

test('checkRefs catches a quill-ingest reference with no tag', () => {
  const violations = checkRefs(['docker.io/library/quill-ingest:']);
  assert.equal(violations.length, 1);
  assert.match(violations[0].reason, /quill-ingest|no tag/);
});

test('the ingest CronJob workload is digest-pinned in the rendered chart', () => {
  const violations = checkRefs(['docker.io/library/quill-ingest@' + DIGEST]);
  assert.deepEqual(violations, []);
});

test('checkRefs: quill workloads must be digest-pinned, third-party images version-pinned', () => {
  const violations = checkRefs([
    'docker.io/library/quill-api:local',
    'docker.io/library/quill-mcp:latest',
    'docker.io/library/postgres:17-alpine',
    'docker.io/cloudflare/cloudflared:latest',
    `docker.io/library/quill-portal@${DIGEST}`,
  ]);
  const refs = violations.map((v) => v.ref);
  assert.deepEqual(refs, [
    'docker.io/library/quill-api:local',
    'docker.io/library/quill-mcp:latest',
    'docker.io/cloudflare/cloudflared:latest',
  ]);
});

test('checkRefs rejects a quill workload pinned by an immutable tag instead of a digest', () => {
  const violations = checkRefs(['docker.io/library/quill-api:2026-09-21-sha.aa7a2c64b55d']);
  assert.equal(violations.length, 1);
  assert.match(violations[0].reason, /digest-pinned/);
});

test('a Never-pulled workload without a node pin is a violation (ErrImageNeverPull)', () => {
  const rendered = [
    'apiVersion: apps/v1',
    'kind: Deployment',
    'metadata:',
    '  name: quill-mcp',
    'spec:',
    '  template:',
    '    spec:',
    '      containers:',
    '      - name: mcp',
    `        image: "docker.io/library/quill-mcp@${DIGEST}"`,
    '        imagePullPolicy: Never',
  ].join('\n');
  const violations = checkNodePins(rendered);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].ref, 'quill-mcp');
  assert.match(violations[0].reason, /nodeName\/nodeSelector/);
});

test('a Never-pulled workload with nodeName or nodeSelector passes', () => {
  const withNodeName = [
    'kind: Deployment',
    'metadata:',
    '  name: quill-portal',
    'spec:',
    '  template:',
    '    spec:',
    '      nodeName: nexus',
    '      containers:',
    '      - name: portal',
    `        image: "docker.io/library/quill-portal@${DIGEST}"`,
    '        imagePullPolicy: Never',
  ].join('\n');
  assert.deepEqual(checkNodePins(withNodeName), []);

  const withSelector = withNodeName.replace('      nodeName: nexus', '      nodeSelector:\n        kubernetes.io/hostname: nexus');
  assert.deepEqual(checkNodePins(withSelector), []);
});

test('an IfNotPresent workload needs no node pin', () => {
  const rendered = [
    'kind: Deployment',
    'metadata:',
    '  name: third-party',
    'spec:',
    '  template:',
    '    spec:',
    '      containers:',
    '      - name: c',
    '        image: "docker.io/library/postgres:17-alpine"',
    '        imagePullPolicy: IfNotPresent',
  ].join('\n');
  assert.deepEqual(checkNodePins(rendered), []);
});

test('parseImagesBlock reads the per-service pins', () => {
  const parsed = parseImagesBlock(
    ['image:', '  registry: "docker.io/library"', 'images:', '  api:', `    digest: "${DIGEST}"`, '    tag: "2026-09-21-sha.deadbeef1234"', 'api:', '  replicas: 1'].join('\n'),
  );
  assert.deepEqual(Object.keys(parsed), ['api']);
  assert.equal(parsed.api.digest, DIGEST);
  assert.equal(parsed.api.tag, '2026-09-21-sha.deadbeef1234');
});

test('checkProdValues flags a pin block with no digest', () => {
  const bad = ['image:', '  tag: "local"', 'images:', '  api:', '    tag: "local"', '  mcp:', '  portal:', `    digest: "${DIGEST}"`].join('\n');
  const violations = checkProdValues(bad);
  assert.ok(violations.some((v) => v.ref === 'images.api' && /no digest/.test(v.reason)));
  assert.ok(violations.some((v) => v.ref === 'images.mcp'));
  assert.ok(violations.some((v) => /mutable tag/.test(v.reason)), 'a bare `tag: local` must be flagged');
});

test('extractImageRefs finds quoted and unquoted image lines', () => {
  const refs = extractImageRefs(
    ['      containers:', '      - name: a', '        image: "docker.io/library/quill-api@sha256:' + 'b'.repeat(64) + '"', '      - name: b', '        image: nginx:1.27'].join('\n'),
  );
  assert.deepEqual(refs, [`docker.io/library/quill-api@sha256:${'b'.repeat(64)}`, 'nginx:1.27']);
});

test('the production values file pins every quill workload to a digest', () => {
  const text = fs.readFileSync(VALUES_PROD, 'utf8');
  assert.deepEqual(checkProdValues(text), []);
  const images = parseImagesBlock(text);
  for (const svc of QUILL_SERVICES) {
    assert.match(images[svc]?.digest ?? '', /^sha256:[0-9a-f]{64}$/, `images.${svc}.digest must be a full digest`);
    assert.match(images[svc]?.tag ?? '', /^\d{4}-\d{2}-\d{2}-[0-9a-z][0-9a-z.-]*$/, `images.${svc}.tag must be an immutable build tag`);
  }
  assert.equal(/^\s*tag:\s*["']?local["']?\s*$/m.test(text), false, 'values-prod.yaml must not carry a :local tag');
});

test('the chart templates hardcode no mutable image tag', () => {
  assert.deepEqual(checkTemplates(TEMPLATES), []);
});

// Gate-level regression for run 37408574389 / commit bfe587bb: the operator
// command an author runs before pushing ("node scripts/gates/check-image-pins.mjs
// --values charts/quill/values-prod.yaml") said OK on the exact values CI
// failed. Spawn the REAL gate script against a values file carrying the
// bfe587bb ingest tag and assert it exits 1 — the gate must catch what CI
// catches. Fixture: live values-prod with only the ingest tag flipped.
test('the operator gate itself rejects values carrying the bfe587bb date-only ingest tag', () => {
  const GATE = path.join(REPO, 'scripts/gates/check-image-pins.mjs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'image-pins-'));
  const values = fs
    .readFileSync(VALUES_PROD, 'utf8')
    .replace(/^(\s*tag:\s*)'?2026-10-06-f34547a9-dirty'?$/m, "$1'2026-10-05'");
  fs.writeFileSync(path.join(tmp, 'values-prod.yaml'), values);
  const flipped = /tag: '2026-10-05'/.test(values);
  assert.equal(flipped, true, 'fixture must actually carry the bad tag — did the good tag shape change?');
  const r = spawnSync('node', [GATE, '--values', path.join(tmp, 'values-prod.yaml'), '--templates', TEMPLATES], {
    encoding: 'utf8',
  });
  const out = (r.stdout ?? '') + (r.stderr ?? '');
  assert.equal(r.status, 1, `the gate must fail on the bfe587bb values — gate output:\n${out}`);
  assert.match(out, /images\.ingest\.tag.*2026-10-05/);
});
