#!/usr/bin/env tsx
/**
 * Reloader trigger gate — the trigger annotation must render on the Deployment,
 * not on the Secret. Reloader reads workload metadata. A Secret-side
 * `reloader.stakater.com/auto` is inert (measured: 0 reloads executed).
 *
 * Renders the chart rather than asserting over template text: a template that
 * never renders would pass a text assertion. Test both the default (no change
 * to production) and an explicit api.deploymentAnnotations override.
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

function haveHelm(): boolean {
  try {
    execFileSync('helm', ['version', '--short'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function render(values: string): string {
  return execFileSync('helm', ['template', 'quill', CHART, '-f', values], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function apiDeployment(rendered: string): string {
  const doc = rendered
    .split(/^---\s*$/m)
    .map((d) => d.trim())
    .find((d) => d.includes('kind: Deployment') && d.includes('name: quill-api'));
  assert.ok(doc, 'quill-api Deployment must render');
  return doc;
}

test('default values emit no reloader trigger on the api Deployment', { skip: !haveHelm() && 'helm not installed' }, () => {
  const dep = apiDeployment(render(VALUES));
  assert.ok(!dep.includes('reloader.stakater.com'), 'production rendering must stay unchanged');
});

test('api.deploymentAnnotations renders on the Deployment, not the pod template', { skip: !haveHelm() && 'helm not installed' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quill-reloader-'));
  try {
    const values = path.join(dir, 'values.yaml');
    fs.writeFileSync(values, 'api:\n  deploymentAnnotations:\n    reloader.stakater.com/auto: "true"\n');
    const dep = apiDeployment(render(values));
    assert.match(dep, /^  annotations:\n    reloader\.stakater\.com\/auto: "true"$/m,
      'trigger must appear under Deployment metadata.annotations');
    const podTemplate = dep.slice(dep.indexOf('  template:'));
    assert.ok(!podTemplate.includes('reloader.stakater.com'),
      'trigger must not be on the pod template');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
