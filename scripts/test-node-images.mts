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
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  QUILL_IMAGE_SERVICES,
  REGISTRY_HOST,
  digestsToDelete,
  parseRegistryEndpoint,
  pinCommitDecision,
  plan,
} from './gates/check-node-images.mjs';
import {
  OCI_INDEX_MEDIA_TYPE,
  isAttestationManifest,
  selectPlatformManifest,
  singleManifestIndex,
  stagedImageName,
} from './gates/oci-image-manifest.mjs';
import { applyMigrationText } from './apply-image-pins.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VALUES = path.join(REPO, 'charts/quill/values-prod.yaml');
const PIN = path.join(REPO, 'scripts/pin-images.sh');
const GATE_SRC = path.join(REPO, 'scripts/gates/check-node-images.mjs');
const DEPLOY = path.join(REPO, '.github/workflows/deploy-prod.yml');
const GATE = path.join(REPO, 'scripts/gates/check-node-images.mjs');

const text = fs.readFileSync(VALUES, 'utf8');

test('unmigrated values-prod stays on the legacy docker.io Never pin', () => {
  const planned = plan(text);
  assert.equal(planned.mode, 'legacy');
  assert.deepEqual(planned.violations, []);
  assert.equal(planned.pullPolicy, 'Never');
  assert.equal(planned.registry, 'docker.io/library');
  for (const item of planned.refs) {
    assert.equal(item.ref, `docker.io/library/quill-${item.svc}@${item.digest}`);
    assert.match(item.digest, /^sha256:[0-9a-f]{64}$/);
  }
  assert.deepEqual(planned.refs.map((item) => item.svc), [...QUILL_IMAGE_SERVICES]);
});

test('a partial registry migration is rejected', () => {
  const bad = text.replace(
    '  api:\n    digest:',
    '  api:\n    registry: "registry.registry.svc.cluster.local:5000"\n    repository: "quill/api"\n    pullPolicy: IfNotPresent\n    digest:',
  );
  const violations = plan(bad).violations;
  assert.ok(violations.some((line) => /partial registry migration/.test(line)), violations.join('\n'));
});

test('registries.yaml endpoint is the plain-HTTP ClusterIP, else the host', () => {
  const yaml = [
    'mirrors:',
    '  "registry.registry.svc.cluster.local:5000":',
    '    endpoint:',
    '      - "http://192.0.2.34:5000"',
    'configs:',
    '  "registry.registry.svc.cluster.local:5000":',
    '    tls:',
    '      insecure_skip_verify: true',
  ].join('\n');
  assert.equal(parseRegistryEndpoint(yaml), 'http://192.0.2.34:5000');
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

test('pin-images pushes a single-platform image with no attestation manifests', () => {
  const pin = fs.readFileSync(PIN, 'utf8');
  // BuildKit 26+ attaches provenance/SBOM attestations to the index as
  // "unknown/unknown" manifests. `docker save` writes the index but not their
  // blobs, so `ctr images push` died in deploy-prod with
  // "ctr: content digest sha256:44136fa3...: not found".
  const builds = pin.split('\n').filter((line: string) => /^\s*docker build\b/.test(line));
  assert.ok(builds.length > 0, 'pin-images must build images');
  for (const line of builds) {
    assert.match(line, /--provenance=false/, line);
    assert.match(line, /--sbom=false/, line);
  }
  const saves = pin.split('\n').filter((line: string) => /^\s*docker save\b/.test(line));
  assert.ok(saves.length > 0, 'pin-images must save images for the push');
  for (const line of saves) assert.match(line, /--platform linux\/amd64/, line);
  // --platform on push is not the fix: containerd uploads the original index
  // and the registry rejects it (400, manifest list references missing).
  const pushes = pin
    .split('\n')
    .filter((line: string) => /ctr images push/.test(line) && !/^\s*#/.test(line));
  assert.ok(pushes.length > 0, 'pin-images must push images');
  for (const line of pushes) assert.doesNotMatch(line, /--platform/, line);
});

test('deploy-prod checks the pin block before it writes values, then prunes, then commits', () => {
  const src = fs.readFileSync(DEPLOY, 'utf8');
  const check = src.indexOf('check-node-images.mjs --pin-block pin-block.txt --check');
  const migrate = src.indexOf('run: node scripts/apply-image-pins.mjs --migrate');
  const prune = src.indexOf('check-node-images.mjs --values charts/quill/values-prod.yaml --prune --keep 5');
  const commit = src.indexOf('name: Commit and push the pins');
  assert.ok(check > 0, 'deploy-prod must HEAD the pin block');
  assert.ok(migrate > check, 'values-prod is written only after the HEAD check');
  assert.ok(prune > migrate, 'prune runs after the cutover write');
  assert.ok(commit > prune, 'the pin commit is last');
  assert.doesNotMatch(src, /\bssh\b/);
});

test('a pin commit with a missing registry digest is refused and does not rewrite values', () => {
  const digest = (char: string) => `sha256:${char.repeat(64)}`;
  const pins: Record<string, { digest: string; tag: string }> = {};
  const heads: Record<string, { status: number; digest: string }> = {};
  for (const svc of QUILL_IMAGE_SERVICES) {
    pins[svc] = { digest: digest('a'), tag: 'a'.repeat(40) };
    heads[svc] = { status: 200, digest: digest('a') };
  }
  heads.search = { status: 404, digest: '' };
  const refused = pinCommitDecision(pins, heads);
  assert.equal(refused.ok, false);
  assert.ok(refused.missing.some((line) => /search/.test(line) && /404/.test(line)));
  assert.throws(
    () => applyMigrationText(text, pins, heads),
    /refusing pin commit/,
  );
  assert.equal(plan(text).mode, 'legacy', 'the source values stay legacy when the commit is refused');

  heads.search = { status: 200, digest: digest('a') };
  const migrated = applyMigrationText(text, pins, heads);
  const after = plan(migrated);
  assert.equal(after.mode, 'registry');
  assert.deepEqual(after.violations, []);
  for (const item of after.refs) {
    assert.equal(item.ref, `${REGISTRY_HOST}/quill/${item.svc}@${digest('a')}`);
  }
  assert.match(migrated, /^image:\n(?:.*\n)*?  pullPolicy: Never$/m);
});

test('--plan exits 0 on unmigrated values-prod', () => {
  const result = spawnSync('node', [GATE, '--values', VALUES], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /mode: legacy/);
  assert.match(result.stdout, /registry plan: OK/);
  assert.match(result.stdout, /docker\.io\/library\/quill-api@sha256:/);
  assert.doesNotMatch(result.stdout, new RegExp(REGISTRY_HOST.replace(/\./g, '\\.')));
});

// The pinned quill-search content on nexus is an OCI image index from an
// older docker build (charts/quill/values-prod.yaml, search digest
// sha256:993d9045…). Its linux/amd64 child is complete, but the BuildKit
// attestation manifest in the same index points at a config blob
// (sha256:e7d884da…, literally "{}") that was never imported. That missing
// blob is why `ctr images push` died with
// "ctr: content digest sha256:e7d884da…: not found", and why the push now
// publishes the amd64 child manifest instead of the index.
const SEARCH_INDEX_DIGEST = 'sha256:993d9045ec835d1265d7b63396f567c66d3ea7a6456a8c6e6377e2789ec690cd';
const SEARCH_AMD64_MANIFEST = 'sha256:df605779b534c9ee524ec469a3c957e0a46e38d4755d8281f6a704c464e0a086';
const SEARCH_ATTESTATION_MANIFEST = 'sha256:9f64ae152945a99627263ff28b602c4393c1d8726236f09d03e67a34f3bb4105';
const SEARCH_MISSING_ATTESTATION_CONFIG = 'sha256:e7d884dac7ec5f6cd6f34f04972aa109cf6e704f81b9fc949f81eb49d4585924';
const SEARCH_INDEX = {
  schemaVersion: 2,
  mediaType: OCI_INDEX_MEDIA_TYPE,
  manifests: [
    {
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      digest: SEARCH_AMD64_MANIFEST,
      size: 1430,
      platform: { architecture: 'amd64', os: 'linux' },
    },
    {
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      digest: SEARCH_ATTESTATION_MANIFEST,
      size: 837,
      annotations: {
        'vnd.docker.reference.digest': SEARCH_AMD64_MANIFEST,
        'vnd.docker.reference.type': 'attestation-manifest',
      },
      platform: { architecture: 'unknown', os: 'unknown' },
    },
  ],
};

test('quill-search publishes the linux/amd64 child manifest, never the attestation index', () => {
  const selected = selectPlatformManifest(SEARCH_INDEX, 'linux/amd64');
  assert.equal(selected.kind, 'index-child');
  assert.equal(selected.digest, SEARCH_AMD64_MANIFEST);
  assert.equal(selected.size, 1430);
  assert.equal(selected.mediaType, 'application/vnd.oci.image.manifest.v1+json');
  assert.ok(isAttestationManifest(SEARCH_INDEX.manifests[1]));
  assert.deepEqual(selectPlatformManifest(SEARCH_INDEX).digest, SEARCH_AMD64_MANIFEST);

  const refName = stagedImageName('docker.io/library/quill-search-amd64', selected.digest);
  const index = singleManifestIndex(selected, refName, 'linux/amd64');
  assert.equal(index.mediaType, OCI_INDEX_MEDIA_TYPE);
  assert.equal(index.manifests.length, 1);
  assert.deepEqual(index.manifests[0].platform, { architecture: 'amd64', os: 'linux' });
  assert.equal(index.manifests[0].digest, SEARCH_AMD64_MANIFEST);
  assert.equal(index.manifests[0].annotations['org.opencontainers.image.ref.name'], refName);
  const serialized = JSON.stringify(index);
  assert.doesNotMatch(serialized, new RegExp(SEARCH_INDEX_DIGEST.slice(7)));
  assert.doesNotMatch(serialized, /attestation-manifest/);
  assert.doesNotMatch(serialized, new RegExp(SEARCH_MISSING_ATTESTATION_CONFIG.slice(7)));
});

test('a single-platform manifest pin is pushed as itself without re-wrapping an index', () => {
  // After the pin commit values-prod carries the digest the registry served —
  // the amd64 manifest, not the old index. The next deploy must push it again.
  const manifest = {
    schemaVersion: 2,
    mediaType: 'application/vnd.oci.image.manifest.v1+json',
    config: { mediaType: 'application/vnd.oci.image.config.v1+json', digest: 'sha256:' + '5'.repeat(64), size: 2735 },
    layers: [],
  };
  const selected = selectPlatformManifest(manifest, 'linux/amd64');
  assert.equal(selected.kind, 'manifest');
  assert.equal(selected.digest, null, 'the caller supplies the pinned digest for a bare manifest');
});

test('an index without a linux/amd64 child is refused instead of pushed', () => {
  const armOnly = {
    schemaVersion: 2,
    mediaType: OCI_INDEX_MEDIA_TYPE,
    manifests: [
      { mediaType: 'application/vnd.oci.image.manifest.v1+json', digest: 'sha256:' + 'a'.repeat(64), size: 10, platform: { architecture: 'arm64', os: 'linux' } },
    ],
  };
  assert.throws(() => selectPlatformManifest(armOnly), /no linux\/amd64 manifest/);
  const ambiguous = {
    schemaVersion: 2,
    mediaType: OCI_INDEX_MEDIA_TYPE,
    manifests: [
      { ...armOnly.manifests[0], platform: { architecture: 'amd64', os: 'linux' } },
      { ...armOnly.manifests[0], digest: 'sha256:' + 'b'.repeat(64), platform: { architecture: 'amd64', os: 'linux' } },
    ],
  };
  assert.throws(() => selectPlatformManifest(ambiguous), /refusing to guess/);
  assert.throws(() => selectPlatformManifest({ mediaType: 'text/plain' }), /not an image index or image manifest/);
});

test('oci-image-manifest writes a one-entry archive index for the stored search content', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quill-oci-manifest-'));
  const indexOut = path.join(dir, 'index.json');
  try {
    const result = spawnSync(
      'node',
      [
        path.join(REPO, 'scripts/gates/oci-image-manifest.mjs'),
        '--platform',
        'linux/amd64',
        '--ref-prefix',
        'docker.io/library/quill-search-amd64',
        '--digest',
        SEARCH_INDEX_DIGEST,
        '--index-out',
        indexOut,
      ],
      { encoding: 'utf8', input: JSON.stringify(SEARCH_INDEX) },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), SEARCH_AMD64_MANIFEST);
    const index = JSON.parse(fs.readFileSync(indexOut, 'utf8'));
    assert.equal(index.manifests.length, 1);
    assert.equal(index.manifests[0].digest, SEARCH_AMD64_MANIFEST);
    assert.equal(index.manifests[0].platform.architecture, 'amd64');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('push_search_from_store stages the amd64 manifest and pushes it, not the stored index', () => {
  const pin = fs.readFileSync(PIN, 'utf8');
  const start = pin.indexOf('push_search_from_store() {');
  assert.ok(start > 0, 'pin-images must define push_search_from_store');
  const end = pin.indexOf('\n}\n', start);
  const body = pin.slice(start, end);
  // The stored content is resolved through the helper (index → amd64 child),
  // staged as a one-entry OCI archive and imported so the push target is a
  // manifest. The old code re-tagged the source index and pushed it.
  assert.match(body, /oci-image-manifest\.mjs/);
  assert.match(body, /--platform linux\/amd64/);
  assert.match(body, /ctr images import --no-unpack/);
  assert.match(body, /ctr images push --plain-http "\$dest"/);
  assert.doesNotMatch(body, /store_ref_for_digest/);
  assert.doesNotMatch(body, /ctr images tag --force "\$src" "\$dest"/);
  assert.match(body, /record_pin search/);
});
