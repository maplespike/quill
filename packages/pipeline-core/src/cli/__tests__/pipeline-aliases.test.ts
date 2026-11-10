// oss-export: private-only
/**
 * Chart ↔ CLI alias contract.
 *
 * The Helm chart's `ingestion.schedules` keys are passed verbatim as
 * QUILL_PIPELINE in a CronJob env var. A key that is not a PIPELINE_CONFIG
 * alias makes the job exit 1 with "Unknown pipeline" on every tick — a
 * silently dead pipeline. The chart shipped `committees:` and `social:` while
 * the CLI only knew `committee:` and `social-programs:`, so the jobs could
 * never have run; this test is the regression guard for that class.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { PIPELINE_CONFIG } from '../run-pipeline.js';
import { getModule } from '../../ingestion/registry.js';

const CHART_DIR = new URL('../../../../../charts/quill/', import.meta.url).pathname;

/**
 * Collect the keys of every `schedules:` block in a Helm values file.
 * Deliberately line-based: the values files are hand-maintained and adding a
 * YAML parser dependency for one assertion is not worth it. Fails loudly
 * (returns nothing) if the block shape changes, and the caller asserts that
 * at least one key was found.
 */
export function scheduleKeysFromValues(text: string): string[] {
  const keys: string[] = [];
  let inSchedules = false;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\s+#.*$/, '');
    if (/^\s{2,}schedules:\s*$/.test(line)) {
      inSchedules = true;
      continue;
    }
    if (!inSchedules) continue;
    if (line.trim() === '') continue;
    // Dedent out of the schedules block (back to `ingestion:` level or above).
    if (!/^\s{4,}\S/.test(line)) {
      inSchedules = false;
      continue;
    }
    const m = line.match(/^\s+([A-Za-z0-9_-]+):\s*(.+)$/);
    if (m) keys.push(m[1]);
  }
  return keys;
}

describe('chart ingestion schedules', () => {
  const values = fs.readFileSync(`${CHART_DIR}values.yaml`, 'utf-8');
  const valuesProd = fs.readFileSync(`${CHART_DIR}values-prod.yaml`, 'utf-8');

  it('parses the schedules blocks (guards the parser itself)', () => {
    assert.ok(
      scheduleKeysFromValues(values).length > 10,
      'values.yaml schedules block must be readable',
    );
    assert.ok(
      scheduleKeysFromValues(valuesProd).length > 0,
      'values-prod.yaml must schedule at least one pipeline',
    );
  });

  it('every scheduled pipeline is a known QUILL_PIPELINE alias', () => {
    const keys = [...scheduleKeysFromValues(values), ...scheduleKeysFromValues(valuesProd)];
    const unknown = keys.filter(k => !(k in PIPELINE_CONFIG));
    assert.deepEqual(
      unknown,
      [],
      `chart schedules pipelines the CLI cannot run (they exit 1 as "Unknown pipeline"): ${unknown.join(', ')}`,
    );
  });

  it('every alias points at a module that exists in the registry', () => {
    const dangling = Object.entries(PIPELINE_CONFIG)
      .filter(([, moduleName]) => !getModule(moduleName))
      .map(([alias, moduleName]) => `${alias} → ${moduleName}`);
    assert.deepEqual(dangling, [], `aliases point at unregistered modules: ${dangling.join(', ')}`);
  });

  it('production actually enables ingestion', () => {
    const match = valuesProd.match(/^ingestion:\s*$[\s\S]*?^\s+enabled:\s*(\S+)/m);
    assert.ok(match, 'values-prod.yaml must carry an ingestion.enabled switch');
    assert.equal(match[1], 'true', 'ingestion.enabled must be true in production');
  });
});
