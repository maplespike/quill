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

export function plan(text) {
  const violations = [];
  const registry = parseImageField(text, 'registry');
  const prefix = parseImageField(text, 'repositoryPath');
  const pullPolicy = parseImageField(text, 'pullPolicy');
  if (registry !== REGISTRY_HOST) {
    violations.push(`image.registry must be ${REGISTRY_HOST} (got ${registry || '<empty>'})`);
  }
  if (prefix !== 'quill') {
    violations.push(`image.repositoryPath must be quill (got ${prefix || '<empty>'})`);
  }
  if (pullPolicy !== 'IfNotPresent') {
    violations.push(`image.pullPolicy must be IfNotPresent (got ${pullPolicy || '<empty>'})`);
  }
  if (pullPolicy === 'Never') {
    violations.push('imagePullPolicy Never is not allowed');
  }
  const refs = [];
  const images = parseImagesBlock(text);
  for (const [svc, pin] of Object.entries(images)) {
    if (!pin.digest) {
      violations.push(`images.${svc} has no digest`);
      continue;
    }
    if (!/^sha256:[0-9a-f]{64}$/.test(pin.digest)) {
      violations.push(`images.${svc}.digest is not a sha256 digest`);
      continue;
    }
    const ref = `${quillRepository(text, svc, pin)}@${pin.digest}`;
    const expected = `${REGISTRY_HOST}/quill/${svc}@${pin.digest}`;
    if (ref !== expected) {
      violations.push(`${svc} renders ${ref}, want ${expected}`);
    }
    refs.push({ svc, repo: `quill/${svc}`, digest: pin.digest, ref });
  }
  if (refs.length === 0) violations.push('no pinned digests');
  return { registry, prefix, pullPolicy, refs, violations };
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
  console.log(`registry: ${planned.registry || '<empty>'}`);
  console.log(`repositoryPath: ${planned.prefix || '<empty>'}`);
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
