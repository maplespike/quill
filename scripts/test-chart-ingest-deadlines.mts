#!/usr/bin/env tsx
/**
 * Ingest deadline gate — no pipeline may be given less time than it needs.
 *
 * Incident (QUILL-AUDIT.md 2026-10-24, P2): Job
 * `quill-ingest-influence-29879100` failed with "Job was active longer than
 * specified deadline" (2026-10-23 04:00 CDT) at the chart's one-size
 * `activeDeadlineSeconds: 1800`. The next run finished in 9 min, so the work
 * is real and the deadline was the wrong number.
 *
 * The gate renders the chart and reads the Job specs. A text assertion over the
 * template would pass on a template that never renders.
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

/** Render the chart and return `{ <cronjob name>: <activeDeadlineSeconds> }`. */
function deadlines(): Record<string, number> {
  const rendered = execFileSync('helm', ['template', 'quill', CHART, '-f', VALUES], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const out: Record<string, number> = {};
  for (const doc of rendered.split(/^---\s*$/m)) {
    if (!/^kind:\s*CronJob$/m.test(doc)) continue;
    const name = doc.match(/^\s*name:\s*(\S+)\s*$/m)?.[1];
    const deadline = doc.match(/^\s*activeDeadlineSeconds:\s*(\d+)\s*$/m)?.[1];
    if (!name) continue;
    out[name] = deadline === undefined ? NaN : Number(deadline);
  }
  return out;
}

test('chart: every ingest CronJob declares a numeric activeDeadlineSeconds', (t) => {
  if (!haveHelm()) {
    t.skip('helm is not installed on this runner — cannot render the chart');
    return;
  }
  const all = deadlines();
  const ingest = Object.entries(all).filter(([name]) => name.includes('-ingest-'));
  assert.ok(ingest.length > 0, 'chart must render ingest CronJobs');
  for (const [name, deadline] of ingest) {
    assert.ok(
      Number.isFinite(deadline) && deadline > 0,
      `${name} has no positive activeDeadlineSeconds (got ${deadline})`,
    );
  }
});

test('chart: influence gets more headroom than the chart default', (t) => {
  if (!haveHelm()) {
    t.skip('helm is not installed on this runner — cannot render the chart');
    return;
  }
  const all = deadlines();
  const influence = Object.entries(all).find(([name]) => name.endsWith('-ingest-influence'));
  assert.ok(influence, 'chart must render the influence CronJob');
  const [, deadline] = influence as [string, number];

  // 1800s is the value the 2026-10-23 run failed on. The override must beat it.
  assert.ok(
    deadline > 1800,
    `influence activeDeadlineSeconds is ${deadline}s — the run that failed on deadline had 1800s`,
  );
  assert.equal(deadline, 3600, 'influence deadline is pinned at 3600s by values.yaml');
});

test('chart: the override is scoped to influence, not applied to every pipeline', (t) => {
  if (!haveHelm()) {
    t.skip('helm is not installed on this runner — cannot render the chart');
    return;
  }
  const all = deadlines();
  const committees = Object.entries(all).find(([name]) => name.endsWith('-ingest-committees'));
  assert.ok(committees, 'chart must render the committees CronJob');
  assert.equal((committees as [string, number])[1], 1800, 'committees keeps the chart default');
});
