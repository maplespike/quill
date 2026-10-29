#!/usr/bin/env node
// Registry pin check. No SSH. No per-node containerd import.
//
// Quill images are pushed to the in-cluster registry and pulled with
// imagePullPolicy IfNotPresent. nexus and sentry-agent both mirror
// registry.registry.svc.cluster.local:5000 in /etc/rancher/k3s/registries.yaml
// (plain HTTP, endpoint pinned to the ClusterIP).
//
//   node scripts/gates/check-node-images.mjs --values charts/quill/values-prod.yaml
//   node scripts/gates/check-node-images.mjs --values charts/quill/values-prod.yaml --check
//   node scripts/gates/check-node-images.mjs --values charts/quill/values-prod.yaml --prune --keep 5
//   node scripts/gates/check-node-images.mjs --endpoint
//   node scripts/gates/check-node-images.mjs --digest-of quill/api <tag-or-digest>
//
// --plan (the default) does not touch the network. CI runs it.
// --check HEADs each pinned digest on the registry v2 API and fails if the
// manifest is missing or Docker-Content-Digest does not match.
// --prune keeps that pinned digest plus the last N tags per service and
// DELETEs the other manifests. The registry API only unlinks the manifest.
// Blob deletion is a server-side `registry garbage-collect`.
//
// QUILL_REGISTRY_ENDPOINT overrides the URL (http://<clusterIP>:5000).
// Otherwise the endpoint is read from registries.yaml when that file exists.

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseImagesBlock, parseImageField, quillRepository } from './check-image-pins.mjs';

export const REGISTRY_HOST = 'registry.registry.svc.cluster.local:5000';
export const REGISTRIES_FILE = '/etc/rancher/k3s/registries.yaml';
export const MANIFEST_ACCEPT = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(', ');

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function parseRegistryEndpoint(yaml, host = REGISTRY_HOST) {
  const lines = String(yaml ?? '').split('\n');
  const hostRe = new RegExp(
    `^\\s+["']?${host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']?\\s*:`,
  );
  let mirrors = false;
  let inHost = false;
  let inEndpoint = false;
  for (const line of lines) {
    if (/^mirrors:\s*$/.test(line)) {
      mirrors = true;
      inHost = false;
      inEndpoint = false;
      continue;
    }
    if (mirrors && /^[A-Za-z]/.test(line)) {
      mirrors = false;
      continue;
    }
    if (!mirrors) continue;
    if (hostRe.test(line)) {
      inHost = true;
      inEndpoint = false;
      continue;
    }
    if (inHost && /^\s{2}\S/.test(line)) {
      inHost = false;
      inEndpoint = false;
    }
    if (!inHost) continue;
    if (/^\s+endpoint:\s*$/.test(line)) {
      inEndpoint = true;
      continue;
    }
    if (!inEndpoint) continue;
    const item = /^\s+-\s+["']?(https?:\/\/[^"'\s]+)["']?\s*$/.exec(line);
    if (item) return item[1];
  }
  return `http://${host}`;
}

export function resolveEndpoint(env = process.env, file = REGISTRIES_FILE) {
  const override = String(env.QUILL_REGISTRY_ENDPOINT ?? '').trim();
  if (override) return override.replace(/\/$/, '');
  if (file && existsSync(file)) {
    return parseRegistryEndpoint(readFileSync(file, 'utf8')).replace(/\/$/, '');
  }
  return `http://${REGISTRY_HOST}`;
}

export const QUILL_IMAGE_SERVICES = ['api', 'mcp', 'portal', 'ingest', 'search'];

function pinMigrated(pin) {
  return Boolean(pin && (pin.registry || pin.repository || pin.pullPolicy));
}

export function plan(text) {
  const violations = [];
  const registry = parseImageField(text, 'registry');
  const pullPolicy = parseImageField(text, 'pullPolicy');
  const images = parseImagesBlock(text);
  const pins = QUILL_IMAGE_SERVICES.map((svc) => ({ svc, pin: images[svc] || {} }));
  const migrated = pins.filter((item) => pinMigrated(item.pin));
  const mode = migrated.length === 0 ? 'legacy' : 'registry';
  if (migrated.length > 0 && migrated.length !== pins.length) {
    violations.push(
      `partial registry migration (${migrated.map((item) => item.svc).join(', ')}). Every service must switch in the same commit, or none do`,
    );
  }
  const refs = [];
  for (const { svc, pin } of pins) {
    if (!pin.digest || !/^sha256:[0-9a-f]{64}$/.test(pin.digest)) {
      violations.push(`images.${svc}.digest is missing or not sha256`);
      continue;
    }
    if (mode === 'legacy') {
      if (pinMigrated(pin)) continue;
      const ref = `docker.io/library/quill-${svc}@${pin.digest}`;
      if (quillRepository(text, svc, pin) !== `docker.io/library/quill-${svc}`) {
        violations.push(`${svc} legacy ref must stay docker.io/library/quill-${svc}`);
      }
      refs.push({ svc, repo: `quill/${svc}`, digest: pin.digest, ref, legacy: true });
      continue;
    }
    if (pin.registry !== REGISTRY_HOST) {
      violations.push(`images.${svc}.registry must be ${REGISTRY_HOST}`);
    }
    if (pin.repository !== `quill/${svc}`) {
      violations.push(`images.${svc}.repository must be quill/${svc}`);
    }
    if (pin.pullPolicy !== 'IfNotPresent') {
      violations.push(`images.${svc}.pullPolicy must be IfNotPresent`);
    }
    const ref = `${REGISTRY_HOST}/quill/${svc}@${pin.digest}`;
    refs.push({ svc, repo: `quill/${svc}`, digest: pin.digest, ref, legacy: false });
  }
  if (mode === 'legacy') {
    if (registry !== 'docker.io/library') {
      violations.push(`legacy image.registry must stay docker.io/library (got ${registry || '<empty>'})`);
    }
    if (pullPolicy !== 'Never') {
      violations.push('legacy image.pullPolicy must stay Never until every service is migrated');
    }
  }
  if (refs.length === 0) violations.push('no pinned digests');
  return { mode, registry, pullPolicy, refs, violations };
}

/**
 * All-or-nothing gate for the pin commit.
 * heads[svc] is {status, digest} from the registry manifest API.
 * A missing service, a non-200, or a digest mismatch refuses the commit.
 */
export function pinCommitDecision(pins, heads) {
  const missing = [];
  for (const svc of QUILL_IMAGE_SERVICES) {
    const pin = pins?.[svc];
    const head = heads?.[svc];
    if (!pin?.digest || !/^sha256:[0-9a-f]{64}$/.test(pin.digest)) {
      missing.push(`${svc}: no sha256 digest in the pin block`);
      continue;
    }
    if (!head || head.status !== 200) {
      missing.push(`${svc}: registry returned HTTP ${head?.status ?? 'none'}`);
      continue;
    }
    if (head.digest !== pin.digest) {
      missing.push(`${svc}: registry digest ${head.digest || '<empty>'} does not match pin ${pin.digest}`);
    }
  }
  return { ok: missing.length === 0, missing };
}

/** Pin block printed by pin-images.sh. */
export function parsePinBlock(text) {
  const pins = {};
  const re = /^\s{2}([a-z][a-z0-9-]*):\s*$\n\s{4}digest:\s*"([^"]+)"\s*$\n\s{4}tag:\s*"([^"]*)"\s*$/gm;
  let match;
  while ((match = re.exec(String(text))) !== null) {
    pins[match[1]] = { digest: match[2], tag: match[3] };
  }
  return pins;
}

/**
 * Manifest digests to DELETE.
 * Keep the pinned digest, and the digests of the `keepCount` newest tags.
 * @param {{tag: string, digest: string, time: number}[]} entries
 */
export function digestsToDelete(entries, pinnedDigest, keepCount) {
  const sorted = [...entries].sort((a, b) => b.time - a.time || (a.tag < b.tag ? 1 : a.tag > b.tag ? -1 : 0));
  const keep = new Set();
  if (pinnedDigest) keep.add(pinnedDigest);
  for (const entry of sorted.slice(0, keepCount)) keep.add(entry.digest);
  const all = new Set(entries.map((entry) => entry.digest).filter(Boolean));
  return [...all].filter((digest) => !keep.has(digest)).sort();
}

function argValue(argv, flag) {
  const i = argv.indexOf(flag);
  if (i === -1) return null;
  return argv[i + 1] ?? '';
}

function nextPage(link, endpoint) {
  if (!link) return '';
  const match = /<([^>]+)>;\s*rel="next"/.exec(link);
  if (!match) return '';
  const raw = match[1];
  if (/^https?:\/\//.test(raw)) return raw;
  const base = new URL(endpoint);
  return new URL(raw, base).toString();
}

async function registryFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: MANIFEST_ACCEPT, ...(options.headers ?? {}) },
  });
  return response;
}

export async function readManifestDigest(endpoint, repo, reference) {
  const url = `${endpoint}/v2/${repo}/manifests/${reference}`;
  let response = await registryFetch(url, { method: 'HEAD' });
  if (response.status === 404 || response.status === 405) {
    response = await registryFetch(url, { method: 'GET' });
  }
  const digest = response.headers.get('docker-content-digest') || '';
  return { status: response.status, digest };
}

async function listTags(endpoint, repo) {
  const tags = [];
  let url = `${endpoint}/v2/${repo}/tags/list?n=1000`;
  const seen = new Set();
  while (url && !seen.has(url)) {
    seen.add(url);
    const response = await registryFetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    if (response.status === 404) return [];
    if (!response.ok) {
      throw new Error(`tag list ${repo} returned HTTP ${response.status}`);
    }
    const body = await response.json();
    for (const tag of body.tags ?? []) tags.push(tag);
    url = nextPage(response.headers.get('link'), endpoint);
  }
  return tags;
}

function tagTime(tag) {
  const result = spawnSync('git', ['-C', REPO_ROOT, 'log', '-1', '--format=%ct', tag], {
    encoding: 'utf8',
  });
  if (result.status !== 0) return 0;
  const value = Number(String(result.stdout).trim());
  return Number.isFinite(value) ? value : 0;
}

export async function checkRegistry(text, endpoint) {
  const planned = plan(text);
  if (planned.mode === 'legacy') {
    return [{
      ref: 'values',
      reason: 'values-prod is still the legacy docker.io pin. Refusing to look up those containerd digests in the registry',
    }];
  }
  if (planned.violations.length) {
    return planned.violations.map((reason) => ({ ref: 'plan', reason }));
  }
  const violations = [];
  for (const item of planned.refs) {
    let got;
    try {
      got = await readManifestDigest(endpoint, item.repo, item.digest);
    } catch (err) {
      violations.push({ ref: item.ref, reason: err.message });
      continue;
    }
    if (got.status === 404) {
      violations.push({ ref: item.ref, reason: `registry has no manifest for ${item.digest}` });
      continue;
    }
    if (got.status !== 200) {
      violations.push({ ref: item.ref, reason: `manifest API returned HTTP ${got.status}` });
      continue;
    }
    if (got.digest && got.digest !== item.digest) {
      violations.push({ ref: item.ref, reason: `registry digest ${got.digest} does not match pin ${item.digest}` });
      continue;
    }
    if (!got.digest) {
      violations.push({ ref: item.ref, reason: 'manifest response has no Docker-Content-Digest header' });
      continue;
    }
    console.log(`ok ${item.repo} ${item.digest}`);
  }
  return violations;
}

export async function pruneRegistry(text, endpoint, keepCount) {
  const planned = plan(text);
  if (planned.mode === 'legacy') {
    return {
      deleted: [],
      errors: ['values-prod is still the legacy pin. Refusing to prune before the registry cutover commit'],
    };
  }
  if (planned.violations.length) {
    return { deleted: [], errors: planned.violations };
  }
  const deleted = [];
  const errors = [];
  for (const item of planned.refs) {
    let tags;
    try {
      tags = await listTags(endpoint, item.repo);
    } catch (err) {
      errors.push(`${item.repo}: ${err.message}`);
      continue;
    }
    const entries = [];
    for (const tag of tags) {
      let got;
      try {
        got = await readManifestDigest(endpoint, item.repo, tag);
      } catch (err) {
        errors.push(`${item.repo}:${tag}: ${err.message}`);
        continue;
      }
      if (got.status !== 200 || !got.digest) continue;
      entries.push({ tag, digest: got.digest, time: tagTime(tag) });
    }
    const drop = digestsToDelete(entries, item.digest, keepCount);
    for (const digest of drop) {
      const url = `${endpoint}/v2/${item.repo}/manifests/${digest}`;
      const response = await registryFetch(url, { method: 'DELETE' });
      if (response.status === 200 || response.status === 202 || response.status === 404) {
        deleted.push(`${item.repo}@${digest}`);
        console.log(`deleted ${item.repo}@${digest}`);
      } else {
        errors.push(`DELETE ${item.repo}@${digest} returned HTTP ${response.status}. The registry must allow deletes. Blob space is only freed by a server-side registry garbage-collect.`);
      }
    }
  }
  return { deleted, errors };
}

async function main(argv) {
  const valuesPath = argValue(argv, '--values') || path.join(REPO_ROOT, 'charts/quill/values-prod.yaml');
  const endpoint = resolveEndpoint();

  if (argv.includes('--endpoint')) {
    process.stdout.write(`${endpoint}\n`);
    return 0;
  }

  if (argv.includes('--digest-of')) {
    const repo = argValue(argv, '--digest-of');
    const reference = argv[argv.indexOf('--digest-of') + 2];
    if (!repo || !reference) {
      console.error('registry: --digest-of needs <repo> <tag-or-digest>');
      return 2;
    }
    const got = await readManifestDigest(endpoint, repo, reference);
    if (got.status !== 200 || !/^sha256:[0-9a-f]{64}$/.test(got.digest)) {
      console.error(`registry: ${repo}:${reference} returned HTTP ${got.status} digest '${got.digest}'`);
      return 1;
    }
    process.stdout.write(`${got.digest}\n`);
    return 0;
  }

  if (argv.includes('--pin-block')) {
    const blockPath = argValue(argv, '--pin-block');
    if (!blockPath) {
      console.error('registry: --pin-block needs a path');
      return 2;
    }
    const pins = parsePinBlock(readFileSync(blockPath, 'utf8'));
    const heads = {};
    for (const svc of QUILL_IMAGE_SERVICES) {
      const digest = pins[svc]?.digest;
      if (!digest) {
        heads[svc] = { status: 0, digest: '' };
        continue;
      }
      try {
        heads[svc] = await readManifestDigest(endpoint, `quill/${svc}`, digest);
      } catch (err) {
        heads[svc] = { status: 0, digest: '' };
        console.error(`registry: ${svc}: ${err.message}`);
      }
    }
    const decision = pinCommitDecision(pins, heads);
    if (!decision.ok) {
      for (const reason of decision.missing) {
        console.error(`registry: FAIL ${reason}`);
        if (process.env.GITHUB_ACTIONS) console.error(`::error::${reason}`);
      }
      console.error('registry: pin commit refused. values-prod.yaml was not modified');
      return 1;
    }
    console.log(`registry: pin block OK (${QUILL_IMAGE_SERVICES.length} digests at ${endpoint})`);
    return 0;
  }

  const text = readFileSync(valuesPath, 'utf8');

  if (argv.includes('--check')) {
    const violations = await checkRegistry(text, endpoint);
    if (violations.length) {
      for (const item of violations) {
        console.error(`registry: FAIL ${item.ref} — ${item.reason}`);
        if (process.env.GITHUB_ACTIONS) console.error(`::error::${item.ref} — ${item.reason}`);
      }
      console.error(`registry: FAILED (${violations.length})`);
      return 1;
    }
    const planned = plan(text);
    console.log(`registry: OK (${planned.refs.length} digests at ${endpoint})`);
    return 0;
  }

  if (argv.includes('--prune')) {
    const keep = Number(argValue(argv, '--keep') ?? 5);
    if (!Number.isInteger(keep) || keep < 1) {
      console.error('registry: --keep must be a positive integer');
      return 2;
    }
    const result = await pruneRegistry(text, endpoint, keep);
    for (const error of result.errors) {
      console.error(`registry: FAIL ${error}`);
      if (process.env.GITHUB_ACTIONS) console.error(`::error::${error}`);
    }
    console.log(`registry: pruned ${result.deleted.length} manifest(s). Kept the pinned digest and the ${keep} newest tags per service.`);
    console.log('registry: manifest DELETE does not free blob space. A server-side `registry garbage-collect` must run in the registry pod.');
    return result.errors.length ? 1 : 0;
  }

  const planned = plan(text);
  console.log(`mode: ${planned.mode}`);
  console.log(`registry: ${planned.registry || '<empty>'}`);
  console.log(`pullPolicy: ${planned.pullPolicy || '<empty>'}`);
  for (const item of planned.refs) console.log(`${item.svc} ${item.ref}`);
  if (planned.violations.length) {
    for (const reason of planned.violations) console.error(`registry: ${reason}`);
    return 1;
  }
  console.log(`registry plan: OK (${planned.refs.length} digests)`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(`registry: ${err.message}`);
      process.exit(1);
    },
  );
}
