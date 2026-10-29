#!/usr/bin/env node
// Eligible-node image check.
//
// Quill images use imagePullPolicy: Never. kubelet will not pull them.
// The digest must already be in the containerd store of every node a pod
// can schedule on. Those nodes are the heavy affinity hosts in
// charts/quill/values-prod.yaml (nexus and sentry-agent). forge is not
// one of them.
//
// deploy-prod builds on nexus (scripts/pin-images.sh), imports the tarball
// into that node's containerd, then copies the same tarball to each other
// eligible node over ssh. This script is the check that follows:
//
//   node scripts/gates/check-node-images.mjs --values charts/quill/values-prod.yaml --plan
//   node scripts/gates/check-node-images.mjs --values charts/quill/values-prod.yaml --peers-of nexus
//   node scripts/gates/check-node-images.mjs --values charts/quill/values-prod.yaml --refs --except "api mcp portal ingest"
//   node scripts/gates/check-node-images.mjs --values charts/quill/values-prod.yaml --check
//
// --plan, --peers-of, and --refs do not touch a cluster. CI runs those.
// --check reads each node's containerd store (local `k3s ctr`, ssh for the
// rest) and exits 1 when any pinned digest name is missing. deploy-prod
// runs --check on nexus after the import and before the pin commit.
//
// There is no registry and no pull secret. GHCR is retired. The bytes move
// as a containerd export. This stays on the machines the cluster already has.

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseImagesBlock, ELIGIBLE_NEVER_HOSTS } from './check-image-pins.mjs';

const strip = (s) => String(s ?? '').trim().replace(/^["']/, '').replace(/["']$/, '');

/** Heavy-workload hostnames from the values-prod anchor. */
export function parseHeavyHosts(text) {
  const lines = String(text).split('\n');
  const hosts = [];
  let grab = false;
  for (const line of lines) {
    if (/^affinityHosts:\s*&quillHeavyHosts\s*$/.test(line)) {
      grab = true;
      continue;
    }
    if (!grab) continue;
    const item = /^  - ([A-Za-z0-9._-]+)\s*$/.exec(line);
    if (item) {
      hosts.push(item[1]);
      continue;
    }
    if (line.trim() === '' || /^  #/.test(line)) continue;
    break;
  }
  return hosts;
}

/**
 * The heavy host list must be exactly the nodes that receive Never-pulled
 * images. A missing node, an extra node, or forge is a failed plan.
 */
export function validateHeavyHosts(hosts) {
  const violations = [];
  const got = new Set(hosts);
  for (const host of ELIGIBLE_NEVER_HOSTS) {
    if (!got.has(host)) violations.push(`heavy affinityHosts missing ${host}`);
  }
  if (got.has('forge')) violations.push('forge is ultra-light only and must not receive Never-pulled quill images');
  for (const host of hosts) {
    if (!ELIGIBLE_NEVER_HOSTS.includes(host)) {
      violations.push(`${host} is not an eligible Never-pull node (${ELIGIBLE_NEVER_HOSTS.join(', ')})`);
    }
  }
  return violations;
}

export function parseRegistry(text) {
  const m = /^image:\n(?:[ \t].*\n)*?^  registry:\s*["']?([^"'\s#]+)/m.exec(String(text));
  return m ? m[1] : 'docker.io/library';
}

/** Every images.<svc>.digest as the repo@digest name kubelet resolves. */
export function pinnedRefs(text) {
  const registry = parseRegistry(text);
  const images = parseImagesBlock(text);
  const refs = [];
  for (const [svc, pin] of Object.entries(images)) {
    if (!pin.digest) continue;
    const repo = pin.repository || `${registry}/quill-${svc}`;
    refs.push({ svc, ref: `${repo}@${pin.digest}`, digest: pin.digest });
  }
  return refs;
}

export function peersOf(hosts, node) {
  return hosts.filter((host) => host !== node);
}

export function plan(text) {
  const hosts = parseHeavyHosts(text);
  return {
    hosts,
    violations: validateHeavyHosts(hosts),
    refs: pinnedRefs(text),
  };
}

function shortHostname() {
  return os.hostname().split('.')[0].toLowerCase();
}

function listStore(host) {
  const localArgs = ['-n', 'k8s.io', 'images', 'ls', '-q'];
  let result;
  if (host === shortHostname()) {
    result = spawnSync('sudo', ['-n', 'k3s', 'ctr', ...localArgs], { encoding: 'utf8' });
    if (result.status !== 0) {
      result = spawnSync('k3s', ['ctr', ...localArgs], { encoding: 'utf8' });
    }
  } else {
    result = spawnSync('ssh', [
      '-o', 'BatchMode=yes',
      '-o', 'ConnectTimeout=20',
      host,
      'sudo -n k3s ctr -n k8s.io images ls -q',
    ], { encoding: 'utf8' });
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.error?.message || 'ctr failed')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 4)
      .join(' ');
    throw new Error(`${host}: ${detail}`);
  }
  return new Set(result.stdout.split('\n').map((line) => line.trim()).filter(Boolean));
}

export function checkStores(text) {
  const planned = plan(text);
  if (planned.violations.length) return planned.violations.map((reason) => ({ ref: 'hosts', reason }));
  if (planned.refs.length === 0) {
    return [{ ref: 'images', reason: 'no pinned digests in values' }];
  }
  const violations = [];
  for (const host of planned.hosts) {
    let names;
    try {
      names = listStore(host);
    } catch (err) {
      violations.push({ ref: host, reason: err.message });
      continue;
    }
    for (const { ref } of planned.refs) {
      if (!names.has(ref)) {
        violations.push({
          ref,
          reason: `${host} containerd store has no ${ref} (imagePullPolicy: Never; pod will stay ErrImageNeverPull)`,
        });
      } else {
        console.log(`ok ${host} ${ref}`);
      }
    }
  }
  return violations;
}

function argValue(argv, flag) {
  const i = argv.indexOf(flag);
  if (i === -1) return null;
  return argv[i + 1] ?? '';
}

function main(argv) {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const valuesPath = argValue(argv, '--values') || path.join(repo, 'charts/quill/values-prod.yaml');
  const text = readFileSync(valuesPath, 'utf8');
  const planned = plan(text);
  const except = new Set(strip(argValue(argv, '--except') ?? '').split(/[\s,]+/).filter(Boolean));

  if (planned.violations.length && (argv.includes('--plan') || argv.includes('--peers-of') || argv.includes('--refs') || argv.includes('--check'))) {
    for (const reason of planned.violations) console.error(`node images: ${reason}`);
    return 1;
  }

  if (argv.includes('--peers-of')) {
    const node = argValue(argv, '--peers-of');
    if (!node) {
      console.error('node images: --peers-of needs a hostname');
      return 2;
    }
    process.stdout.write(`${peersOf(planned.hosts, node).join(' ')}\n`);
    return 0;
  }

  if (argv.includes('--refs')) {
    for (const item of planned.refs) {
      if (except.has(item.svc)) continue;
      process.stdout.write(`${item.ref}\n`);
    }
    return 0;
  }

  if (argv.includes('--check')) {
    const violations = checkStores(text);
    if (violations.length) {
      for (const v of violations) {
        console.error(`node images: FAIL ${v.ref} — ${v.reason}`);
        if (process.env.GITHUB_ACTIONS) console.error(`::error::${v.ref} — ${v.reason}`);
      }
      console.error(`node images: FAILED (${violations.length})`);
      return 1;
    }
    console.log(`node images: OK (${planned.refs.length} digests × ${planned.hosts.length} nodes: ${planned.hosts.join(', ')})`);
    return 0;
  }

  // --plan is the default. No cluster access.
  console.log(`hosts: ${planned.hosts.join(' ')}`);
  console.log(`peers-of-nexus: ${peersOf(planned.hosts, 'nexus').join(' ')}`);
  for (const item of planned.refs) console.log(`${item.svc} ${item.ref}`);
  if (planned.refs.length === 0) {
    console.error('node images: no pinned digests');
    return 1;
  }
  console.log(`node images: plan OK (${planned.refs.length} digests, hosts ${planned.hosts.join(', ')})`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
