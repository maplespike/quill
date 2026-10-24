// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Change-gate coverage guard.
 *
 * The gate is opt-in per module (probe-urls.ts). That opt-in is a decision, and
 * a decision that is not enforced silently rots: a new pipeline gets scheduled
 * in the chart, nobody adds a probe, and it polls blindly forever — exactly the
 * condition the gate exists to remove.
 *
 * This test makes the decision explicit. Every SCHEDULED pipeline must be
 * either gated (has probe URLs) or named in UNGATED_BY_DESIGN with a reason.
 * Adding a scheduled pipeline without deciding fails here.
 *
 * It is static (reads the chart + the map; no network, no cluster).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROBE_URLS, probeUrlsFor } from '../../ingestion/probe-urls.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const VALUES = resolve(HERE, '../../../../../charts/quill/values-prod.yaml');

/**
 * Scheduled pipelines that are deliberately NOT gated, each with the measured
 * reason. Anything not in PROBE_URLS and not listed here fails this test.
 */
const UNGATED_BY_DESIGN: Record<string, string> = {
  realtime:
    'Continuous feed: its alert API body differs on every fetch, so a content ' +
    'hash reports "changed" every run and the gate never skips — while adding a ' +
    'round-trip per run. A stream needs push, not a gated poll.',
};

/** Parse the chart's `ingestion.schedules` block: alias -> cron (non-null only). */
function scheduledPipelines(): Record<string, string> {
  const yaml = readFileSync(VALUES, 'utf8');
  const lines = yaml.split('\n');
  const start = lines.findIndex(l => /^  schedules:\s*$/.test(l));
  assert.ok(start >= 0, 'ingestion.schedules block not found in values-prod.yaml');

  const out: Record<string, string> = {};
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^  \S/.test(line) && !/^    /.test(line)) break; // next top-level key
    const m = line.match(/^    ([A-Za-z0-9_-]+):\s*(.+?)\s*$/);
    if (!m) continue;
    const [, alias, raw] = m;
    const cron = raw.replace(/^['"]|['"]$/g, '');
    if (cron && cron !== 'null') out[alias] = cron;
  }
  return out;
}

describe('change-gate coverage', () => {
  const scheduled = scheduledPipelines();

  it('parsed a non-trivial schedule set', () => {
    assert.ok(
      Object.keys(scheduled).length >= 5,
      `expected several scheduled pipelines, parsed ${Object.keys(scheduled).length}`,
    );
  });

  it('every scheduled pipeline is either gated or a documented exception', () => {
    // The chart uses short aliases; the probe map is keyed by registry module
    // name. Resolve through the same alias map the CLI uses.
    const ungated = Object.keys(scheduled).filter(alias => {
      const moduleName = ALIAS_TO_MODULE[alias] ?? alias;
      const gated = probeUrlsFor(moduleName).length > 0;
      return !gated && !(alias in UNGATED_BY_DESIGN);
    });

    assert.deepEqual(
      ungated,
      [],
      `Scheduled pipeline(s) with no change gate and no documented reason: ${ungated.join(', ')}. ` +
        'Either add probe URLs (probe-urls.ts) or add an UNGATED_BY_DESIGN entry with the measured reason.',
    );
  });

  it('UNGATED_BY_DESIGN has no stale entries', () => {
    const stale = Object.keys(UNGATED_BY_DESIGN).filter(alias => !(alias in scheduled));
    assert.deepEqual(
      stale,
      [],
      `UNGATED_BY_DESIGN names pipeline(s) that are not scheduled: ${stale.join(', ')}. Remove them.`,
    );
  });

  it('every probe URL is an absolute https URL', () => {
    for (const [moduleName, urls] of Object.entries(PROBE_URLS)) {
      for (const url of urls) {
        assert.match(
          url,
          /^https:\/\/[^\s]+$/,
          `${moduleName}: probe URL must be absolute https — got ${url}`,
        );
      }
    }
  });
});

/**
 * Chart alias -> registry module name, mirroring cli/run-pipeline.ts
 * PIPELINE_CONFIG. Kept minimal: only the aliases this guard needs to resolve.
 */
const ALIAS_TO_MODULE: Record<string, string> = {
  committees: 'committees',
  gazette: 'gazette',
  oversight: 'oversight',
  corporate: 'corporate',
  influence: 'influence',
  'ngo-rss': 'ngo-influence-rss',
  realtime: 'real-time-feeds',
};
