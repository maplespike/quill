#!/usr/bin/env tsx
/**
 * Ingest suspend gate: suspension is declared in values, not patched live.
 *
 * 2026-11-05 20:03 CT: corporate, gazette and influence were suspended with
 * `kubectl patch`, outside git. Argo could not see it and /v1/ingest/status
 * went stale for four days. The chart now renders `suspend` on every ingest
 * CronJob from `ingestion.suspended`.
 *
 * corporate must stay suspended in prod until SEDI scraping is removed.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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

/** Render the chart and return `{ <cronjob name>: <suspend> }` for ingest jobs. */
function suspends(): Record<string, string | undefined> {
  const rendered = execFileSync('helm', ['template', 'quill', CHART, '-f', VALUES], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const out: Record<string, string | undefined> = {};
  for (const doc of rendered.split(/^---\s*$/m)) {
    if (!/^kind:\s*CronJob$/m.test(doc)) continue;
    const name = doc.match(/^\s*name:\s*(\S+)\s*$/m)?.[1];
    if (!name || !name.includes('-ingest-')) continue;
    out[name] = doc.match(/^\s{2}suspend:\s*(\S+)\s*$/m)?.[1];
  }
  return out;
}

test('chart: every ingest CronJob renders an explicit suspend', (t) => {
  if (!haveHelm()) {
    t.skip('helm is not installed on this runner — cannot render the chart');
    return;
  }
  const all = Object.entries(suspends());
  assert.ok(all.length > 0, 'chart must render ingest CronJobs');
  for (const [name, value] of all) {
    assert.ok(value === 'true' || value === 'false', `${name} has no explicit suspend (got ${value})`);
  }
});

test('prod: corporate is suspended, gazette and influence run', (t) => {
  if (!haveHelm()) {
    t.skip('helm is not installed on this runner — cannot render the chart');
    return;
  }
  const all = suspends();
  const get = (p: string) => Object.entries(all).find(([n]) => n.endsWith(`-ingest-${p}`))?.[1];
  assert.equal(get('corporate'), 'true', 'corporate must stay suspended until SEDI scraping is removed');
  assert.equal(get('gazette'), 'false', 'gazette runs');
  assert.equal(get('influence'), 'false', 'influence runs');
  assert.equal(get('committees'), 'false', 'committees runs');
});
