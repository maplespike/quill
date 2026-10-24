#!/usr/bin/env tsx
/**
 * Chart probe gate — the api Deployment must declare real health probes.
 *
 * Incident (QUILL-AUDIT.md 2026-10-24, P1): the live `quill-api` Deployment had
 * `.livenessProbe = null` and `.readinessProbe = null` while the portal had
 * both. A hung API kept its endpoints, and a rolling update replaced pods with
 * no readiness gate. The probes also pointed operators at `/health`, which the
 * API answered with 404.
 *
 * The chart is the deploy source (ArgoCD renders charts/quill), so the gate
 * renders the chart and reads the result. A text assertion over the template
 * would pass on a template that never renders.
 *
 * `helm` is required to render; the gate skips with a visible reason when the
 * binary is absent, because a missing tool is not a chart defect.
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

/** Split a multi-document render into documents. */
function docs(rendered: string): string[] {
  return rendered
    .split(/^---\s*$/m)
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
}

/** The api Deployment document, identified by its labels, not its order. */
function apiDeployment(rendered: string): string {
  const match = docs(rendered).find(
    (d) => /^kind:\s*Deployment$/m.test(d) && /app:\s*quill-api\b/.test(d),
  );
  assert.ok(match, 'charts/quill must render a Deployment labelled app: quill-api');
  return match as string;
}

test('chart: helm renders charts/quill with values-prod.yaml', (t) => {
  if (!haveHelm()) {
    t.skip('helm is not installed on this runner — cannot render the chart');
    return;
  }
  const rendered = render();
  assert.ok(rendered.length > 1000, 'render produced no manifests');
  assert.ok(fs.existsSync(path.join(ROOT, CHART, 'Chart.yaml')));
});

test('chart: the api Deployment declares liveness and readiness probes on /v1/health', (t) => {
  if (!haveHelm()) {
    t.skip('helm is not installed on this runner — cannot render the chart');
    return;
  }
  const api = apiDeployment(render());

  for (const probe of ['livenessProbe', 'readinessProbe']) {
    const block = api.split(new RegExp(`^\\s*${probe}:`, 'm'))[1];
    assert.ok(block, `quill-api Deployment has no ${probe} (QUILL-AUDIT.md 2026-10-24)`);

    // The probe must name the real health path. `path: /health` reached a 404
    // before the API grew a 308 to /v1/health; probing /v1/health directly
    // keeps the probe off the redirect.
    const pathMatch = block.match(/path:\s*(\S+)/);
    assert.ok(pathMatch, `${probe} has no httpGet path`);
    assert.equal(pathMatch?.[1], '/v1/health', `${probe} must probe /v1/health`);
    assert.match(block, /port:\s*http/, `${probe} must probe the named http port`);
  }
});

test('chart: api probe timings are bounded (no probe longer than 30s period)', (t) => {
  if (!haveHelm()) {
    t.skip('helm is not installed on this runner — cannot render the chart');
    return;
  }
  const api = apiDeployment(render());
  for (const probe of ['livenessProbe', 'readinessProbe']) {
    const block = api.split(new RegExp(`^\\s*${probe}:`, 'm'))[1] ?? '';
    const period = Number(block.match(/periodSeconds:\s*(\d+)/)?.[1] ?? NaN);
    const timeout = Number(block.match(/timeoutSeconds:\s*(\d+)/)?.[1] ?? NaN);
    assert.ok(Number.isFinite(period) && period > 0 && period <= 30, `${probe} periodSeconds out of range`);
    assert.ok(Number.isFinite(timeout) && timeout > 0 && timeout < period, `${probe} timeoutSeconds must be below periodSeconds`);
  }
});
