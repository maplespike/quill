#!/usr/bin/env node
// Gate A3-IMAGEPIN (#755) — image references must be immutable.
//
// Policy enforced here (see docs/IMAGE-PINNING.md):
//   1. No mutable tags anywhere: :local, :latest, :stable, :main, :prod, …
//   2. Quill workloads (quill-api / quill-mcp / quill-portal) MUST be pinned to
//      a content digest — they are imported into the node containerd store and
//      a digest cannot be re-pointed at new layers.
//   3. Third-party images must be digest- or version-pinned (postgres:17-alpine,
//      cloudflared:2026.8.2) — never a rolling tag.
//   4. A workload whose container uses `imagePullPolicy: Never` (local import)
//      must declare an explicit node pin (`nodeName` / `nodeSelector`), because
//      the store lives on one node; otherwise the pod dies with
//      ErrImageNeverPull on the next reschedule.
//
// Usage:
//   node scripts/gates/check-image-pins.mjs --values charts/quill/values-prod.yaml
//   node scripts/gates/check-image-pins.mjs --values <f> --rendered <helm output>
//   node scripts/gates/check-image-pins.mjs --values <f> --live   # kubectl read-back
//
// Exit 0 + "image pins: OK" on success; exit 1 + every violation otherwise.
// Pure Node (no deps): CI has no helm and no cluster access.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const QUILL_SERVICES = ['api', 'mcp', 'portal'];

// Rolling tags that must never reach a manifest.
export const MUTABLE_TAGS = new Set([
  'local', 'latest', 'stable', 'main', 'master', 'prod', 'production', 'dev',
  'develop', 'edge', 'nightly', 'head', 'rolling', 'current', 'unstable',
]);

// A digest reference: repo@sha256:<64 lowercase hex>.
export const DIGEST_REF_RE = /@sha256:[0-9a-f]{64}$/;

// An immutable tag: a date-stamped build tag (2026-09-21-sha.aa7a2c64b55d) or
// a pinned upstream version (17-alpine, 2026.8.2, v1.2.3-rc1).
export const IMMUTABLE_TAG_RE =
  /^(?:\d{4}-\d{2}-\d{2}-[0-9a-z][0-9a-z.-]*|v?\d+(?:\.\d+)*(?:-[0-9a-z][0-9a-z.-]*)?)$/;

export const QUILL_IMAGE_RE = /(?:^|\/)quill-(api|mcp|portal)(?:$|[:@])/;

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

/**
 * Policy 4: a container with `imagePullPolicy: Never` needs a node pin.
 * Splits a rendered manifest into documents and inspects each workload.
 */
export function checkNodePins(renderedText) {
  const violations = [];
  for (const doc of String(renderedText).split(/^---\s*$/m)) {
    if (!/^kind:\s*(Deployment|StatefulSet|DaemonSet|ReplicaSet|Job|CronJob)\s*$/m.test(doc)) continue;
    if (!/imagePullPolicy:\s*Never/.test(doc)) continue;
    if (!/^\s*nodeName:\s*\S+/m.test(doc) && !/^\s*nodeSelector:/m.test(doc)) {
      const name = (/^\s*name:\s*(\S+)/m.exec(doc) || [])[1] || '<unnamed>';
      violations.push({
        ref: name,
        reason: 'pulls an image with imagePullPolicy: Never but declares no nodeName/nodeSelector — the containerd store is per node (ErrImageNeverPull on reschedule)',
      });
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
  const out = execFileSync(
    'kubectl',
    ['-n', namespace, 'get', 'deploy,statefulset,daemonset,cronjob', '-o', 'jsonpath={range .items[*]}{.metadata.name}{"\\t"}{range .spec.template.spec.containers[*]}{.image}{"\\n"}{end}{end}'],
    { encoding: 'utf8' },
  );
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

  if (violations.length) {
    for (const v of violations) console.error(`image pin violation: ${v.ref} — ${v.reason}`);
    console.error(`image pins: FAILED (${violations.length} violation(s), ${checked} refs checked)`);
    return 1;
  }
  console.log(`image pins: OK (${checked} refs checked; values=${path.relative(repo, valuesPath)}${renderedPath ? `, rendered=${renderedPath}` : ''}${live ? ', live=yes' : ''})`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
