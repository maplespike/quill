#!/usr/bin/env tsx
/**
 * ReadWriteOnce rollout gate.
 *
 * A Deployment that mounts one ReadWriteOnce volume cannot surge. The old
 * pod keeps the claim, and the new pod stays 0/1. Kubernetes defaults that
 * Deployment to RollingUpdate when strategy is omitted, and when strategy
 * is set but type is omitted. Recreate frees the claim first.
 *
 * The chart is the deploy source. This file renders charts/quill with
 * default values and with values-prod.yaml. A text match on the template
 * would pass when the template never renders.
 *
 * scripts/fixtures/rwo-rolling-update.yaml is the negative fixture. It is
 * not a chart render. The checker must report the bad Deployments in it.
 *
 * `helm` is required for the render tests. CI installs it first. A missing
 * binary outside CI skips those tests. The fixture test does not need helm.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

const CHART = 'charts/quill';
const PROD_VALUES = 'charts/quill/values-prod.yaml';
const FIXTURE = 'scripts/fixtures/rwo-rolling-update.yaml';

const FIXTURE_OFFENDERS = [
  'explicit-rolling',
  'inline-volume-claim',
  'mounts-volume-claim',
  'omitted-strategy',
  'omitted-type',
];

type Strategy = 'Recreate' | 'RollingUpdate' | 'default' | 'other';

interface Offender {
  name: string;
  strategy: 'RollingUpdate' | 'default';
}

interface VolumeClaim {
  name: string;
  rwo: boolean;
}

function documents(rendered: string): string[] {
  return rendered
    .split(/^---\s*$/m)
    .map((doc) => doc.trim())
    .filter((doc) => /^kind:\s*\S+/m.test(doc));
}

function kindOf(doc: string): string | undefined {
  return doc.match(/^kind:\s*(\S+)\s*$/m)?.[1];
}

function metadataName(doc: string): string | undefined {
  const block = doc.match(/^metadata:\n((?:[ \t].*\n)*)/m)?.[1] ?? '';
  return block.match(/^[ \t]+name:\s*["']?([^"'\s]+)["']?\s*$/m)?.[1];
}

function strategyOf(doc: string): Strategy {
  const block = doc.match(/^ {2}strategy:\n((?: {4}.*\n)*)/m)?.[1];
  if (block === undefined) return 'default';
  let type: string | undefined;
  for (const line of block.split('\n')) {
    if (/^\s*#/.test(line)) continue;
    const match = line.match(/^ {4}type:\s*["']?([^"'\s]+)["']?/);
    if (match) {
      type = match[1];
      break;
    }
  }
  if (!type) return 'default';
  if (type === 'Recreate') return 'Recreate';
  if (type === 'RollingUpdate') return 'RollingUpdate';
  return 'other';
}

function claimNames(doc: string): string[] {
  const names: string[] = [];
  for (const line of doc.split('\n')) {
    if (/^\s*#/.test(line)) continue;
    const match = line.match(/^\s*claimName:\s*["']?([^"'\s]+)["']?\s*(?:#.*)?$/);
    if (match) names.push(match[1]);
  }
  return names;
}

/** volumeClaimTemplates on a workload, or an inline volumeClaimTemplate. */
function volumeClaimsIn(doc: string): VolumeClaim[] {
  const lines = doc.split('\n');
  const claims: VolumeClaim[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*#/.test(line)) continue;
    const header = line.match(/^(\s*)volumeClaimTemplates?:\s*(.*)$/);
    if (!header) continue;
    const indent = header[1].length;
    const inline = header[2].trim();
    const chunk = [line];
    if (inline === '' || inline === '|' || inline === '>') {
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j];
        if (next.trim() === '' || /^\s*#/.test(next)) {
          chunk.push(next);
          continue;
        }
        const nextIndent = next.match(/^(\s*)/)?.[1].length ?? 0;
        const listAtKey = nextIndent === indent && /^[ \t]*- /.test(next);
        if (nextIndent <= indent && !listAtKey) break;
        chunk.push(next);
      }
    }
    const text = chunk.filter((entry) => !/^\s*#/.test(entry)).join('\n');
    const rwo = /\bReadWriteOnce\b/.test(text);
    const names = [...text.matchAll(/^\s*name:\s*["']?([^"'\s]+)["']?\s*$/gm)].map((match) => match[1]);
    if (names.length === 0) claims.push({ name: '', rwo });
    else for (const name of names) claims.push({ name, rwo });
  }
  return claims;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rwoIndex(docs: string[]): { exact: Set<string>; patterns: RegExp[] } {
  const exact = new Set<string>();
  const patterns: RegExp[] = [];
  for (const doc of docs) {
    const kind = kindOf(doc);
    const owner = metadataName(doc);
    if (kind === 'PersistentVolumeClaim') {
      const rwo = doc.split('\n').some((line) => !/^\s*#/.test(line) && /\bReadWriteOnce\b/.test(line));
      if (rwo && owner) exact.add(owner);
      continue;
    }
    // A Deployment's own volume claim is checked on that Deployment.
    if (kind === 'Deployment') continue;
    for (const claim of volumeClaimsIn(doc)) {
      if (!claim.rwo || !claim.name || !owner) continue;
      patterns.push(new RegExp(`^${escapeRegExp(claim.name)}-${escapeRegExp(owner)}-\\d+$`));
    }
  }
  return { exact, patterns };
}

function mountsRwo(doc: string, exact: Set<string>, patterns: RegExp[]): boolean {
  if (volumeClaimsIn(doc).some((claim) => claim.rwo)) return true;
  for (const name of claimNames(doc)) {
    if (exact.has(name)) return true;
    if (patterns.some((pattern) => pattern.test(name))) return true;
  }
  return false;
}

/** Deployments that mount a chart-defined ReadWriteOnce claim and roll. */
export function rwoRollingUpdateDeployments(rendered: string): Offender[] {
  const docs = documents(rendered);
  const { exact, patterns } = rwoIndex(docs);
  const hits: Offender[] = [];
  for (const doc of docs) {
    if (kindOf(doc) !== 'Deployment') continue;
    const strategy = strategyOf(doc);
    if (strategy !== 'RollingUpdate' && strategy !== 'default') continue;
    if (!mountsRwo(doc, exact, patterns)) continue;
    hits.push({ name: metadataName(doc) ?? '?', strategy });
  }
  return hits;
}

function haveHelm(): boolean {
  try {
    execFileSync('helm', ['version', '--short'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function render(values?: string): string {
  const args = ['template', 'quill', CHART];
  if (values) args.push('-f', values);
  return execFileSync('helm', args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function deploymentDoc(rendered: string, name: string): string {
  const doc = documents(rendered).find((entry) => kindOf(entry) === 'Deployment' && metadataName(entry) === name);
  assert.ok(doc, `charts/quill must render a Deployment named ${name}`);
  return doc as string;
}

function skipOrFail(t: { skip: (reason?: string) => void }): boolean {
  if (haveHelm()) return false;
  if (process.env.CI) {
    assert.fail('helm is not installed. CI must install helm before the RWO strategy gate.');
  }
  t.skip('helm is not installed on this machine — cannot render the chart');
  return true;
}

test('fixture: RollingUpdate on a chart-defined ReadWriteOnce claim is reported', () => {
  const rendered = fs.readFileSync(path.join(ROOT, FIXTURE), 'utf8');
  const hits = rwoRollingUpdateDeployments(rendered);
  assert.deepEqual(hits.map((hit) => hit.name).sort(), [...FIXTURE_OFFENDERS].sort());
  const byName = new Map(hits.map((hit) => [hit.name, hit.strategy]));
  assert.equal(byName.get('explicit-rolling'), 'RollingUpdate');
  assert.equal(byName.get('inline-volume-claim'), 'RollingUpdate');
  assert.equal(byName.get('omitted-strategy'), 'default');
  assert.equal(byName.get('omitted-type'), 'default');
  assert.equal(byName.get('mounts-volume-claim'), 'default');
});

test('chart: default values use Recreate for ReadWriteOnce Deployments', (t) => {
  if (skipOrFail(t)) return;
  const rendered = render();
  const hits = rwoRollingUpdateDeployments(rendered);
  assert.deepEqual(hits, [], `default values: ${JSON.stringify(hits)}`);
  assert.equal(strategyOf(deploymentDoc(rendered, 'quill-search')), 'Recreate');
});

test('chart: production values use Recreate for ReadWriteOnce Deployments', (t) => {
  if (skipOrFail(t)) return;
  const rendered = render(PROD_VALUES);
  const hits = rwoRollingUpdateDeployments(rendered);
  assert.deepEqual(hits, [], `production values: ${JSON.stringify(hits)}`);
  assert.equal(strategyOf(deploymentDoc(rendered, 'quill-search')), 'Recreate');
  // The API SQLite claim is the other ReadWriteOnce Deployment mount.
  assert.equal(strategyOf(deploymentDoc(rendered, 'quill-api')), 'Recreate');
});
