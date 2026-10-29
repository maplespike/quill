#!/usr/bin/env node
// Gate A3-IMAGEPIN (#755) — image references must be immutable.
//
// Policy enforced here (see docs/IMAGE-PINNING.md):
//   1. No mutable tags anywhere: :local, :latest, :stable, :main, :prod, …
//   2. Quill workloads (api, mcp, portal, ingest, search) MUST be pinned to
//      a content digest — they are imported into the node containerd store and
//      a digest cannot be re-pointed at new layers.
//   3. Third-party images must be digest- or version-pinned (postgres:17-alpine,
//      cloudflared:2026.8.2) — never a rolling tag.
//   4. Production pullPolicy is IfNotPresent. Images are pulled from the
//      in-cluster registry, which both eligible nodes mirror. imagePullPolicy
//      Never is rejected in values-prod. If a rendered workload still uses
//      Never, it must be constrained to nexus or sentry-agent (never forge).
//
// Usage:
//   node scripts/gates/check-image-pins.mjs --values charts/quill/values-prod.yaml
//   node scripts/gates/check-image-pins.mjs --values <f> --rendered <helm output>
//   node scripts/gates/check-image-pins.mjs --values <f> --live   # kubectl read-back
//   node scripts/gates/check-image-pins.mjs --values <f> --store  # node containerd resolvability
//
// --store is the gate that catches the "image is in the store but the pod
// still ErrImageNeverPull" class: it asserts each pinned digest has a
// NAMED `<repo>@<digest>` reference in the node's containerd store. A store
// that holds only the `:latest` tag reports the image in `ctr images ls`
// (column 3 is the content digest) while CRI has no repo-digest to resolve
// the chart's `repo@sha256:` reference against — see docs/IMAGE-PINNING.md.
//
// Exit 0 + "image pins: OK" on success; exit 1 + every violation otherwise.
// Pure Node (no deps): CI has no helm and no cluster access.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const QUILL_SERVICES = ['api', 'mcp', 'portal', 'ingest', 'search'];

// Nodes that may run an imagePullPolicy: Never workload. pin-images.sh
// imports every pinned digest into each of these containerd stores.
// forge is intentionally absent (ultra-light only).
export const ELIGIBLE_NEVER_HOSTS = ['nexus', 'sentry-agent'];

// Rolling tags that must never reach a manifest.
export const MUTABLE_TAGS = new Set([
  'local', 'latest', 'stable', 'main', 'master', 'prod', 'production', 'dev',
  'develop', 'edge', 'nightly', 'head', 'rolling', 'current', 'unstable',
]);

// A digest reference: repo@sha256:<64 lowercase hex>.
export const DIGEST_REF_RE = /@sha256:[0-9a-f]{64}$/;

// An immutable tag: a date-stamped build tag (2026-09-21-sha.aa7a2c64b55d) or
// a pinned upstream version (17-alpine, 2026.8.2, v1.2.3-rc1).
//
// The version alternative carries a negative lookahead that blocks any
// date-shaped prefix (2026-10-05, 2026-10, 2026-1, v2026-10-05,
// 2026-10-5-extra): without it, `2026` + `-10-05` parsed like `v1-2-3` and
// the gate accepted date-only tags that scripts/test-image-pins.mts rejects —
// the operator gate said OK on values CI failed (run 37408574389, commit
// bfe587bb). A date-shaped tag must qualify through the first alternative
// instead: `YYYY-MM-DD-<suffix>`, the same shape CI enforces. True version
// pins never start with a 4-digit year followed by dash-digits.
export const IMMUTABLE_TAG_RE =
  /^(?:[0-9a-f]{7,40}|\d{4}-\d{2}-\d{2}-[0-9a-z][0-9a-z.-]*|v?(?!\d{4}-\d{1,2}(?:-\d{1,2})?(?:-|$))\d+(?:\.\d+)*(?:-[0-9a-z][0-9a-z.-]*)?)$/;

export const QUILL_IMAGE_RE = /(?:^|\/)quill(?:-|\/)(api|mcp|portal|ingest|search)(?:$|[:@])/;

const strip = (s) => String(s ?? '').trim().replace(/^["']/, '').replace(/["']$/, '');

/**
 * Classify one image reference.
 * @returns {{ok: boolean, kind: string, reason?: string, tag?: string}}
 */
export function classifyRef(ref) {
  const r = strip(ref);
  if (!r) return { ok: false, kind: 'empty', reason: 'empty image reference' };
  if (r.includes('@')) {
    return DIGEST_REF_RE.test(r)
      ? { ok: true, kind: 'digest' }
      : { ok: false, kind: 'digest', reason: `malformed digest reference: ${r}` };
  }
  const slash = r.lastIndexOf('/');
  const colon = r.lastIndexOf(':');
  if (colon <= slash) {
    return { ok: false, kind: 'tagless', reason: `no tag and no digest: ${r}` };
  }
  const tag = r.slice(colon + 1);
  if (MUTABLE_TAGS.has(tag.toLowerCase())) {
    return { ok: false, kind: 'mutable', reason: `mutable tag :${tag} in ${r}` };
  }
  if (!IMMUTABLE_TAG_RE.test(tag)) {
    return { ok: false, kind: 'unpinned', reason: `tag :${tag} is neither a digest nor an immutable version tag (${r})` };
  }
  return { ok: true, kind: 'tag', tag };
}

/** Policy 1-3 over a list of image references. */
export function checkRefs(refs) {
  const violations = [];
  for (const raw of refs) {
    const ref = strip(raw);
    const c = classifyRef(ref);
    if (!c.ok) {
      violations.push({ ref, reason: c.reason });
      continue;
    }
    if (QUILL_IMAGE_RE.test(ref) && c.kind !== 'digest') {
      violations.push({
        ref,
        reason: 'quill workload image must be digest-pinned (local containerd import; see docs/IMAGE-PINNING.md)',
      });
    }
  }
  return violations;
}

/** Extract `image:` values from a rendered manifest or a values file. */
export function extractImageRefs(text) {
  const refs = [];
  for (const line of String(text).split('\n')) {
    const m = /^\s*-?\s*image:\s*(\S.*?)\s*$/.exec(line);
    if (m) refs.push(strip(m[1]));
  }
  return refs;
}

/** One scalar under the top-level `image:` map. Empty when absent. */
export function parseImageField(text, key) {
  const re = new RegExp(`^image:\\n(?:[ \\t].*\\n)*?^  ${key}:\\s*["']?([^"'\\s#]+)`, 'm');
  const match = re.exec(String(text));
  return match ? strip(match[1]) : '';
}

/**
 * Repository for one Quill service.
 * images.<svc>.repository wins. Else <registry>/<repositoryPath>/<svc>.
 * Else the historical <registry>/quill-<svc> name.
 */
export function quillRepository(valuesText, svc, pin = {}) {
  if (pin.repository) return pin.repository;
  const registry = parseImageField(valuesText, 'registry') || 'docker.io/library';
  const prefix = parseImageField(valuesText, 'repositoryPath');
  if (prefix) return `${registry}/${prefix}/${svc}`;
  return `${registry}/quill-${svc}`;
}

/** Parse the `images:` pin block of a values file. No YAML dependency. */
export function parseImagesBlock(text) {
  const lines = String(text).split('\n');
  const out = {};
  let inBlock = false;
  let current = null;
  for (const line of lines) {
    if (/^[A-Za-z_][\w.-]*:/.test(line)) {
      inBlock = /^images:\s*$/.test(line);
      current = null;
      continue;
    }
    if (!inBlock) continue;
    const svc = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (svc) {
      current = svc[1];
      out[current] = {};
      continue;
    }
    const kv = /^ {4}([A-Za-z0-9_-]+):\s*(\S.*?)\s*$/.exec(line);
    if (kv && current) out[current][kv[1]] = strip(kv[2]);
  }
  return out;
}

/** Policy for the production values file: every Quill service carries a digest. */
export function checkProdValues(text) {
  const violations = [];
  const images = parseImagesBlock(text);
  for (const svc of QUILL_SERVICES) {
    const pin = images[svc];
    if (!pin || Object.keys(pin).length === 0) {
      violations.push({ ref: `images.${svc}`, reason: 'no pin block (needs digest/ tag — see docs/IMAGE-PINNING.md)' });
      continue;
    }
    if (!pin.digest) {
      violations.push({ ref: `images.${svc}`, reason: 'no digest: the local import path must pin by digest' });
    } else if (!DIGEST_REF_RE.test(`quill-${svc}@${pin.digest}`)) {
      violations.push({ ref: `images.${svc}.digest`, reason: `malformed digest: ${pin.digest}` });
    }
    if (pin.tag) {
      const c = classifyRef(`quill-${svc}:${pin.tag}`);
      if (!c.ok) violations.push({ ref: `images.${svc}.tag`, reason: `build tag is not immutable: ${pin.tag}` });
    }
  }
  if (parseImageField(text, 'pullPolicy') === 'Never') {
    violations.push({
      ref: 'image.pullPolicy',
      reason: 'production pullPolicy must be IfNotPresent. Never keeps the image on one node, and infra does not allow copying it to the other',
    });
  }
  // No mutable tag may survive anywhere in the file's image plumbing.
  for (const line of String(text).split('\n')) {
    if (/^\s*#/.test(line)) continue;
    const m = /^\s*(tag|registry|image):\s*["']?([^"'#\s]+)/.exec(line);
    if (!m) continue;
    const c = classifyRef(`x/y:${m[2]}`);
    if (!c.ok && c.kind === 'mutable') {
      violations.push({ ref: line.trim(), reason: `mutable tag in ${m[1]}: ${m[2]}` });
    }
  }
  return violations;
}

function unquote(value) {
  return String(value).trim().replace(/^["']|["']$/g, '');
}

/**
 * Hosts a Never-pulled pod is actually limited to.
 * nodeName, a kubernetes.io/hostname nodeSelector, or required nodeAffinity
 * (hostname In) count. A label selector that is not that hostname does not:
 * the pod can still land on a node whose containerd store lacks the digest.
 * @returns {string[]} empty when the pod is not constrained to hostnames
 */
export function neverPullHosts(doc) {
  const hosts = new Set();
  const nodeName = /^\s*nodeName:\s*(\S+)\s*$/m.exec(doc);
  if (nodeName) {
    const name = unquote(nodeName[1]);
    if (name && name !== '~' && name !== 'null') hosts.add(name);
  }
  const selector = /^\s*nodeSelector:\s*\n((?:[ \t]+.+\n)*)/m.exec(doc);
  if (selector) {
    const host = /^[ \t]+kubernetes\.io\/hostname:\s*(\S+)\s*$/m.exec(selector[1]);
    if (host) hosts.add(unquote(host[1]));
  }
  // First requiredDuringScheduling block. In this chart that is nodeAffinity;
  // preferredDuringScheduling follows it, before podAntiAffinity's own required
  // block, so the capture stops there and does not pick up anti-affinity.
  const required = /requiredDuringSchedulingIgnoredDuringExecution:([\s\S]*?)(?=\n[ \t]*preferredDuringSchedulingIgnoredDuringExecution:|\n[ \t]*podAntiAffinity:|\n[ \t]*podAffinity:|\n[ \t]*containers:|\n[ \t]*initContainers:|\n[ \t]*volumes:|$)/.exec(doc);
  if (required && /kubernetes\.io\/hostname/.test(required[1]) && /operator:\s*In/.test(required[1])) {
    const values = /values:\s*\n((?:[ \t]*-[ \t]*\S+[ \t]*\n)+)/.exec(required[1]);
    if (values) {
      for (const line of values[1].split('\n')) {
        const item = /^[ \t]*-[ \t]*(\S+)/.exec(line);
        if (item) hosts.add(unquote(item[1]));
      }
    }
  }
  return [...hosts];
}

/**
 * Policy 4: imagePullPolicy Never is legal only on the eligible nodes.
 * Those nodes are the ones deploy-prod imports the digest into.
 */
export function checkNodePins(renderedText, allowedHosts = ELIGIBLE_NEVER_HOSTS) {
  const allowed = new Set(allowedHosts);
  const violations = [];
  for (const doc of String(renderedText).split(/^---\s*$/m)) {
    if (!/^kind:\s*(Deployment|StatefulSet|DaemonSet|ReplicaSet|Job|CronJob)\s*$/m.test(doc)) continue;
    if (!/imagePullPolicy:\s*Never/.test(doc)) continue;
    const name = (/^\s*name:\s*(\S+)/m.exec(doc) || [])[1] || '<unnamed>';
    const hosts = neverPullHosts(doc);
    if (hosts.length === 0) {
      violations.push({
        ref: name,
        reason: `pulls an image with imagePullPolicy: Never but is not limited to an eligible node (${[...allowed].join(', ')}). Needs nodeName, a kubernetes.io/hostname nodeSelector, or required nodeAffinity — otherwise it dies ErrImageNeverPull on a node that has no copy of the digest`,
      });
      continue;
    }
    for (const host of hosts) {
      if (!allowed.has(host)) {
        violations.push({
          ref: name,
          reason: `may schedule on ${host}, which does not receive Never-pulled images (eligible: ${[...allowed].join(', ')})`,
        });
      }
    }
  }
  return violations;
}

/** Template sources must not hardcode a mutable reference. */
export function checkTemplates(dir) {
  const violations = [];
  if (!existsSync(dir)) return violations;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.yaml'))) {
    const text = readFileSync(path.join(dir, f), 'utf8');
    for (const [i, line] of text.split('\n').entries()) {
      const m = /image:\s*[^\n]*?:(local|latest|stable)\b/i.exec(line);
      if (m) {
        violations.push({ ref: `${f}:${i + 1}`, reason: `template hardcodes a mutable tag :${m[1]}` });
      }
    }
  }
  return violations;
}

/** Read the live workload image references back from the cluster. */
export function readLiveRefs(namespace = 'maplespike') {
  // Workloads and CronJobs carry the spec in different places; ask separately
  // (a jsonpath that reaches into a field the kind does not have reports
  // nothing, which would silently hide the ingestion CronJobs).
  const collect = (kinds, path) =>
    execFileSync(
      'kubectl',
      ['-n', namespace, 'get', kinds, '-o', `jsonpath={range .items[*]}{.metadata.name}{"\\t"}${path}{"\\n"}{end}`],
      { encoding: 'utf8' },
    );
  const out =
    collect('deploy,statefulset,daemonset', '{.spec.template.spec.containers[*].image}') +
    collect('cronjob', '{.spec.jobTemplate.spec.template.spec.containers[*].image}');
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, image] = l.split('\t');
      return { name, image };
    });
}

/** Live refs must equal the digests recorded in the values file. */
export function checkLive(refsByWorkload, valuesText) {
  const violations = [];
  const images = parseImagesBlock(valuesText);
  for (const { name, image } of refsByWorkload) {
    const c = classifyRef(image);
    if (!c.ok) violations.push({ ref: name, reason: c.reason });
    const svc = QUILL_IMAGE_RE.exec(image);
    if (svc) {
      const want = images[svc[1]]?.digest;
      if (!want) {
        violations.push({ ref: name, reason: `live ${image} but values-prod has no digest for ${svc[1]}` });
      } else if (!image.endsWith(`@${want}`)) {
        violations.push({ ref: name, reason: `live ${image} does not match the pinned digest ${want}` });
      }
    }
  }
  return violations;
}

/**
 * Named image references in the node's containerd store.
 *
 * Runs on a k3s NODE (the store is per-node and only nexus holds these
 * images). Returns a Set of full references such as
 * "docker.io/library/quill-api@sha256:2733db...".
 */
export function readStoreRefs() {
  let raw;
  for (const cmd of [
    ['sudo', '-n', 'k3s', 'ctr', '-n', 'k8s.io', 'images', 'ls', '-q'],
    ['sudo', '-n', 'ctr', '-n', 'k8s.io', 'images', 'ls', '-q'],
  ]) {
    try {
      raw = execFileSync(cmd[0], cmd.slice(1), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      break;
    } catch {
      /* try the next invocation shape */
    }
  }
  if (raw === undefined) return null; // not a store node — caller must skip
  return new Set(raw.split('\n').map((l) => l.trim()).filter(Boolean));
}

/**
 * Each pinned digest must exist in the store under its own NAME.
 *
 * A tag-only store (`repo:latest`) fails this even though `ctr images ls`
 * lists the content digest: with imagePullPolicy: Never, kubelet resolves
 * the chart's `repo@sha256:` reference against CRI, and CRI only knows a
 * repo-digest if the store carries a `@digest` name. Symptom is exactly
 * ErrImageNeverPull on a rollout that "has" the image.
 */
export function checkStore(valuesText, storeRefs) {
  if (!storeRefs) return [];
  const violations = [];
  const images = parseImagesBlock(valuesText);
  for (const [svc, pin] of Object.entries(images)) {
    const digest = pin.digest;
    if (!digest) continue;
    const want = `${quillRepository(valuesText, svc, pin)}@${digest}`;
    if (!storeRefs.has(want)) {
      violations.push({
        ref: svc,
        reason: `store has no ${want} — tag it first: ctr images tag <repo>:<tag> ${want}`,
      });
    }
  }
  return violations;
}

function main(argv) {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const arg = (flag, fallback) => {
    const i = argv.indexOf(flag);
    return i === -1 ? fallback : argv[i + 1];
  };
  const valuesPath = arg('--values', path.join(repo, 'charts/quill/values-prod.yaml'));
  const renderedPath = arg('--rendered', null);
  const templatesDir = arg('--templates', path.join(repo, 'charts/quill/templates'));
  const live = argv.includes('--live');
  const store = argv.includes('--store');

  const values = readFileSync(valuesPath, 'utf8');
  const violations = [
    ...checkProdValues(values),
    ...checkTemplates(templatesDir),
  ];

  let checked = QUILL_SERVICES.length;
  if (renderedPath) {
    const rendered = readFileSync(renderedPath, 'utf8');
    const refs = extractImageRefs(rendered);
    checked += refs.length;
    violations.push(...checkRefs(refs), ...checkNodePins(rendered));
    const local = refs.filter((r) => /:(?:local|latest|stable)\b/.test(r));
    for (const r of local) violations.push({ ref: r, reason: 'rendered manifest contains a mutable tag' });
  }
  if (live) {
    const refs = readLiveRefs();
    checked += refs.length;
    violations.push(...checkLive(refs, values));
    for (const { name, image } of refs) {
      console.log(`  live ${name}: ${image}`);
    }
  }

  let storeNote = '';
  if (store) {
    const storeRefs = readStoreRefs();
    if (storeRefs === null) {
      storeNote = ', store=skipped (not a k3s node)';
      console.log('  store check: SKIPPED — no containerd/k3s ctr on this host');
    } else {
      violations.push(...checkStore(values, storeRefs));
      storeNote = `, store=${storeRefs.size} refs`;
      for (const ref of storeRefs) if (/quill/.test(ref)) console.log(`  store: ${ref}`);
    }
  }

  if (violations.length) {
    for (const v of violations) console.error(`image pin violation: ${v.ref} — ${v.reason}`);
    console.error(`image pins: FAILED (${violations.length} violation(s), ${checked} refs checked)`);
    return 1;
  }
  console.log(`image pins: OK (${checked} refs checked; values=${path.relative(repo, valuesPath)}${renderedPath ? `, rendered=${renderedPath}` : ''}${live ? ', live=yes' : ''}${storeNote})`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
