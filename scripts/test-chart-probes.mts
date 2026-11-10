#!/usr/bin/env tsx
/**
 * Chart probe gate — each service probes a cheap, correct health path.
 *
 * The chart is the deploy source (ArgoCD renders charts/quill), so the gate
 * renders the chart and reads the result. A text assertion over the template
 * would pass on a template that never renders.
 *
 * `helm` is required. CI installs it before this file runs. A missing binary
 * outside CI is a skip with a visible reason, not a pass.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

const CHART = 'charts/quill';
const VALUES = 'charts/quill/values-prod.yaml';
// Live values-prod is registry-migrated (16927140). The unmigrated case renders
// a frozen pre-migration copy so it keeps testing the legacy docker.io path.
const LEGACY_VALUES = 'scripts/fixtures/values-prod-legacy.yaml';
const REGISTRY = 'registry.registry.svc.cluster.local:5000';
const QUILL_APPS = ['api', 'mcp', 'search', 'ingest'];

/** Probe path and whether a slow process needs a startupProbe. */
const SERVICES: Record<string, { path: string; startup: boolean }> = {
  'quill-api': { path: '/v1/health', startup: true },
  'quill-mcp': { path: '/health', startup: true },
  'quill-search': { path: '/health', startup: true },
};

function haveHelm(): boolean {
  try {
    execFileSync('helm', ['version', '--short'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function render(values: string = VALUES): string {
  return execFileSync('helm', ['template', 'quill', CHART, '-f', values], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function docs(rendered: string): string[] {
  return rendered
    .split(/^---\s*$/m)
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
}

function deployment(rendered: string, app: string): string {
  const match = docs(rendered).find(
    (d) => /^kind:\s*Deployment$/m.test(d) && new RegExp(`app:\\s*${app}\\b`).test(d),
  );
  assert.ok(match, `charts/quill must render a Deployment labelled app: ${app}`);
  return match as string;
}

/** The first probe block, cut off at the next probe or at env/resources. */
function probeBlock(doc: string, probe: string): string {
  const match = doc.match(new RegExp(`^\\s*${probe}:\\n([\\s\\S]*?)(?=\\n\\s*(?:startupProbe|readinessProbe|livenessProbe|env|resources|volumeMounts|securityContext):)`, 'm'));
  return match?.[1] ?? '';
}

function skipOrFail(t: { skip: (reason?: string) => void }): boolean {
  if (haveHelm()) return false;
  if (process.env.CI) {
    assert.fail('helm is not installed. CI must install helm before the chart probe gate.');
  }
  t.skip('helm is not installed on this machine — cannot render the chart');
  return true;
}

test('chart: helm renders charts/quill with values-prod.yaml', (t) => {
  if (skipOrFail(t)) return;
  const rendered = render();
  assert.ok(rendered.length > 1000, 'render produced no manifests');
  assert.ok(fs.existsSync(path.join(ROOT, CHART, 'Chart.yaml')));
});

test('chart: service probes hit cheap health paths', (t) => {
  if (skipOrFail(t)) return;
  const rendered = render();
  for (const [app, expect] of Object.entries(SERVICES)) {
    const doc = deployment(rendered, app);
    for (const probe of ['livenessProbe', 'readinessProbe']) {
      const block = probeBlock(doc, probe);
      assert.ok(block, `${app} Deployment has no ${probe}`);
      const pathMatch = block.match(/path:\s*(\S+)/);
      assert.equal(pathMatch?.[1], expect.path, `${app} ${probe} must probe ${expect.path}`);
      assert.match(block, /port:\s*\S+/, `${app} ${probe} must name a port`);
      assert.doesNotMatch(block, /path:\s*\/sse\b/, `${app} ${probe} must not hit the authenticated SSE route`);
      assert.doesNotMatch(block, /path:\s*\/mcp\b/, `${app} ${probe} must not hit streamable HTTP`);
      assert.doesNotMatch(block, /path:\s*\/v1\/search\b/, `${app} ${probe} must not run a search`);
    }
    const startup = probeBlock(doc, 'startupProbe');
    if (expect.startup) {
      assert.ok(startup, `${app} starts slowly and needs a startupProbe`);
      assert.equal(startup.match(/path:\s*(\S+)/)?.[1], expect.path);
    } else {
      assert.equal(startup, '', `${app} does not need a startupProbe`);
    }
  }
});

test('chart: probe timings are bounded', (t) => {
  if (skipOrFail(t)) return;
  const rendered = render();
  for (const app of [...Object.keys(SERVICES), 'quill-redis']) {
    const doc = deployment(rendered, app);
    for (const probe of ['startupProbe', 'livenessProbe', 'readinessProbe']) {
      const block = probeBlock(doc, probe);
      if (!block) continue;
      const period = Number(block.match(/periodSeconds:\s*(\d+)/)?.[1] ?? NaN);
      const timeout = Number(block.match(/timeoutSeconds:\s*(\d+)/)?.[1] ?? NaN);
      assert.ok(Number.isFinite(period) && period > 0 && period <= 30, `${app} ${probe} periodSeconds out of range`);
      assert.ok(Number.isFinite(timeout) && timeout > 0 && timeout < period, `${app} ${probe} timeoutSeconds must be below periodSeconds`);
    }
  }
});

test('chart: quill-redis probes survive a slow ping and a slow start', (t) => {
  if (skipOrFail(t)) return;
  const doc = deployment(render(), 'quill-redis');
  const startup = probeBlock(doc, 'startupProbe');
  const liveness = probeBlock(doc, 'livenessProbe');
  const readiness = probeBlock(doc, 'readinessProbe');
  for (const [name, block] of [['startupProbe', startup], ['livenessProbe', liveness], ['readinessProbe', readiness]] as const) {
    assert.ok(block, `quill-redis has no ${name}`);
    assert.match(block, /redis-cli/, `${name} must ping with redis-cli`);
    assert.equal(block.match(/timeoutSeconds:\s*(\d+)/)?.[1], '5', `${name} timeoutSeconds must be 5`);
  }
  assert.equal(liveness.match(/failureThreshold:\s*(\d+)/)?.[1], '5');
  assert.equal(startup.match(/failureThreshold:\s*(\d+)/)?.[1], '30');
  // Cache budget stays. A slow disk is not a reason to raise it.
  assert.match(doc, /cpu:\s*50m/);
  assert.match(doc, /memory:\s*64Mi/);
  assert.match(doc, /cpu:\s*200m/);
  assert.match(doc, /memory:\s*192Mi/);
  assert.match(doc, /"128mb"/);
});

function imagePolicyLines(yaml: string): string[] {
  return yaml
    .split('\n')
    .filter((line) => /^\s*(image|imagePullPolicy):/.test(line))
    .map((line) => line.trim());
}

/** Drop portal image lines. main still renders them; this chart does not. */
function withoutPortalImages(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^image:.*quill[-/]portal/.test(lines[i] ?? '')) {
      if (/^imagePullPolicy:/.test(lines[i + 1] ?? '')) i += 1;
      continue;
    }
    out.push(lines[i] ?? '');
  }
  return out;
}

test('chart: unmigrated (legacy fixture) values-prod renders the legacy docker.io Never pins', (t) => {
  if (skipOrFail(t)) return;
  const legacy = render(LEGACY_VALUES);
  assert.doesNotMatch(legacy, /registry\.registry\.svc\.cluster\.local:5000/);
  assert.match(legacy, /image: "docker\.io\/library\/quill-api@sha256:401dfe6c5cd1bd89cc8e24fa24154d864908411054e248590343dee96a514566"/);
  assert.doesNotMatch(legacy, /quill-portal/);
  assert.match(legacy, /imagePullPolicy: Never/);
});

test('chart: live values-prod renders every quill image from the in-cluster registry', (t) => {
  if (skipOrFail(t)) return;
  const live = render();
  const lines = imagePolicyLines(live);
  const quillImages = lines.filter((l) => /^image:.*quill[-/]/.test(l));
  assert.ok(quillImages.length > 0, 'the chart must render quill images');
  for (const line of quillImages) {
    assert.match(
      line,
      new RegExp(`^image: "${REGISTRY.replace(/\./g, '\\.')}/quill/(?:${QUILL_APPS.join('|')})(?:@sha256:[0-9a-f]{64}|:[0-9a-f]{40})"$`),
      `quill image is not registry-pinned: ${line}`,
    );
  }
  assert.doesNotMatch(live, /docker\.io\/library\/quill-/, 'no quill image may still come from docker.io/library');
  assert.doesNotMatch(live, /quill-portal|quill\/portal/, 'the portal is Cloudflare Pages, not a chart image');
  // Registry images are pulled, so nothing quill-built may stay on Never.
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^image:.*quill\//.test(lines[i]) && /^imagePullPolicy:/.test(lines[i + 1])) {
      assert.equal(lines[i + 1], 'imagePullPolicy: IfNotPresent', `${lines[i]} must pull IfNotPresent`);
    }
  }
});

test("chart: live values-prod matches main's image refs and pull policy", (t) => {
  if (skipOrFail(t)) return;
  const mainDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quill-main-'));
  execFileSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', '+refs/heads/main:refs/remotes/origin/main'], { cwd: ROOT, stdio: 'pipe' });
  execFileSync('git', ['worktree', 'add', '--detach', mainDir, 'origin/main'], {
    cwd: ROOT,
    stdio: 'pipe',
  });
  try {
    const main = execFileSync('helm', ['template', 'quill', path.join(mainDir, 'charts/quill'), '-f', path.join(mainDir, 'charts/quill/values-prod.yaml')], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    assert.deepEqual(withoutPortalImages(imagePolicyLines(render())), withoutPortalImages(imagePolicyLines(main)));
  } finally {
    execFileSync('git', ['worktree', 'remove', '--force', mainDir], { cwd: ROOT });
  }
});
