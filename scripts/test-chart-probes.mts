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
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

const CHART = 'charts/quill';
const VALUES = 'charts/quill/values-prod.yaml';

/** Probe path and whether a slow process needs a startupProbe. */
const SERVICES: Record<string, { path: string; startup: boolean }> = {
  'quill-api': { path: '/v1/health', startup: true },
  'quill-mcp': { path: '/health', startup: true },
  'quill-search': { path: '/health', startup: true },
  'quill-portal': { path: '/health', startup: false },
};

function haveHelm(): boolean {
  try {
    execFileSync('helm', ['version', '--short'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function render(): string {
  return execFileSync('helm', ['template', 'quill', CHART, '-f', VALUES], {
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
  for (const app of Object.keys(SERVICES)) {
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
