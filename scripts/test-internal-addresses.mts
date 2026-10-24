#!/usr/bin/env tsx
/**
 * No private-network address belongs in a tracked file.
 *
 * Incident (QUILL-AUDIT.md 2026-10-24, P2): 24 tracked files carried the
 * operator's network plan — node and ingress addresses on the LAN, a k3s
 * apiserver endpoint, a Redis ClusterIP, a tailnet address, and the CIDR that
 * goes with them. `AGENTS.md` already said "never put the ... LAN plan into a
 * tracked file"; nothing enforced it, so the rule decayed for two years.
 *
 * This gate enforces it. It distinguishes two different things that a naive
 * grep conflates:
 *
 *   - a private ADDRESS (a four-octet RFC 1918 or CGNAT host) is the
 *     operator's topology. Not allowed, outside the deployed manifests.
 *   - a private RANGE (`10.0.0.0/8`, `192.168.0.0/16`) is RFC 1918, public
 *     knowledge, and often the semantics of a network policy. Allowed.
 *
 * Anything still needing a real address reads it from the environment. The
 * deployed manifests keep their pins: the cluster runs from them, and a
 * placeholder there would break the rollout for no secrecy gain (a ClusterIP
 * is not reachable from outside the cluster anyway).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * Deployed manifests. The cluster applies these files, and their addresses are
 * ClusterIP pins the Cloudflare tunnel points at, or the LAN CIDRs a network
 * policy must allow. None of them is reachable from outside the cluster.
 */
const DEPLOYED_MANIFESTS = new Map<string, string>([
  ['k8s/cloudflared/cloudflared.yaml', 'tunnel targets are pinned ClusterIPs of other in-cluster services'],
  ['k8s/maplespike/quill-api-service.yaml', 'pinned ClusterIP; the tunnel config addresses it literally'],
  ['k8s/maplespike/quill-mcp-service.yaml', 'pinned ClusterIP; the tunnel config addresses it literally'],
  ['k8s/maplespike/quill-portal-service.yaml', 'pinned ClusterIP; the tunnel config addresses it literally'],
  ['nix/saas-manifests.nix', 'generates the manifests above; must carry the same pins'],
]);

/** Private IPv4 hosts: RFC1918 plus the CGNAT block Tailscale allocates from. */
const PRIVATE_HOST = [
  /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  /\b192\.168\.\d{1,3}\.\d{1,3}\b/g,
  /\b172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/g,
  /\b100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}\b/g,
];

/** `10.43.0.0/16` is a range declaration, not an address. */
function isCidr(line: string, at: number, len: number): boolean {
  return line.slice(at + len, at + len + 1) === '/';
}

export function findPrivateAddresses(text: string): Array<{ line: number; address: string }> {
  const hits: Array<{ line: number; address: string }> = [];
  text.split('\n').forEach((line, i) => {
    for (const re of PRIVATE_HOST) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        if (isCidr(line, m.index, m[0].length)) continue;
        hits.push({ line: i + 1, address: m[0] });
      }
    }
  });
  return hits;
}

/** Print enough to find the line, not enough to re-publish the address. */
function mask(address: string): string {
  const parts = address.split('.');
  return `${parts[0]}.${parts[1]}.x.x`;
}

function trackedFiles(): string[] {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out.split('\0').filter(Boolean);
}

test('no private-network address in a tracked file', () => {
  const offenders: string[] = [];
  for (const rel of trackedFiles()) {
    if (DEPLOYED_MANIFESTS.has(rel)) continue;
    const abs = path.join(ROOT, rel);
    let raw: Buffer;
    try {
      raw = fs.readFileSync(abs);
    } catch {
      continue; // submodule or dangling index entry
    }
    if (raw.includes(0)) continue; // binary
    if (raw.length > 2 * 1024 * 1024) continue; // generated asset
    for (const hit of findPrivateAddresses(raw.toString('utf8'))) {
      offenders.push(`  ${rel}:${hit.line}  ${mask(hit.address)}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `private-network addresses in tracked files (replace with a placeholder or read from the environment):\n${offenders.join('\n')}`,
  );
});

test('every allowlisted manifest still exists', () => {
  for (const rel of DEPLOYED_MANIFESTS.keys()) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `allowlisted path is gone: ${rel} — drop it from the list`);
  }
});

test('the detector separates addresses from range declarations', () => {
  // Built from parts: this file must not carry an address of its own, or the
  // gate would flag its own source.
  const lan = ['10', '7', '4', '9'].join('.');
  const pod = ['10', '42', '0', '7'].join('.');
  const home = ['192', '168', '4', '7'].join('.');
  const tailnet = ['100', '76', '105', '73'].join('.');
  const private172 = ['172', '16', '5', '4'].join('.');
  const docNet = ['192', '0', '2', '10'].join('.');

  // Addresses must be caught.
  assert.equal(findPrivateAddresses(`  --server https://${lan}:6443`).length, 1);
  assert.equal(findPrivateAddresses(`clusterIP: ${pod}`).length, 1);
  assert.equal(findPrivateAddresses(`ip: ${home}`).length, 1);
  assert.equal(findPrivateAddresses(`probe ${tailnet}:8080`).length, 1);
  assert.equal(findPrivateAddresses(`bind ${private172}`).length, 1);

  // Ranges and public test addresses must not.
  assert.deepEqual(findPrivateAddresses('            cidr: 10.43.0.0/16'), []);
  assert.deepEqual(findPrivateAddresses('        nets: [192.168.0.0/16]'), []);
  assert.deepEqual(findPrivateAddresses(`  ip: ${docNet}`), []);
  assert.deepEqual(findPrivateAddresses('  https://quill.maplespike.ca'), []);
  assert.deepEqual(findPrivateAddresses('  ip: 8.8.8.8'), []);
});
