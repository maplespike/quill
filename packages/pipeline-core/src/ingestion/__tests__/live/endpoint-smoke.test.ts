import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getAllModules } from '../../registry.js';
import { probeEndpoint, LIVE_PROBE_MAX_ATTEMPTS, LIVE_PROBE_TIMEOUT_MS } from '../../live-probe.js';

/**
 * Live reachability probe. One GET per distinct healthCheckUrl.
 *
 * Do not start a full ingest from this file. A full ingest waits in httpGet's
 * per-host token loop before any request timeout starts, and that wait has
 * no deadline. The 2026-11-09 run (42638195165) was cancelled at the 20
 * minute job limit while still queued on open.canada.ca, with no failure
 * line for the in-flight module. A timeout here throws and names the URL.
 */

const shouldRun = process.env.LIVE_DATA_TEST === 'true';

function noteEndpoint(url: string): void {
  const file = process.env.LIVE_SMOKE_ENDPOINT_FILE;
  if (file) fs.writeFileSync(file, url);
  console.log(`# probing ${url}`);
}

describe('Live endpoint smoke tests', { skip: !shouldRun }, () => {
  if (!shouldRun) return;

  const skipped: string[] = [];
  const missing: string[] = [];
  const byUrl = new Map<string, string[]>();

  for (const mod of getAllModules()) {
    const pattern = mod.testCallPattern ?? 'runModule';
    if (pattern === 'skip') {
      skipped.push(mod.name);
      continue;
    }
    const url = mod.healthCheckUrl;
    if (!url) {
      missing.push(mod.name);
      continue;
    }
    const names = byUrl.get(url) ?? [];
    names.push(mod.name);
    byUrl.set(url, names);
  }

  for (const name of skipped) {
    it(`[SKIP] ${name}`, () => {});
  }

  for (const name of missing) {
    it(name, () => {
      throw new Error(
        `no healthCheckUrl for module ${name} — refusing to run a full ingest with no per-request deadline`,
      );
    });
  }

  for (const [url, names] of byUrl) {
    // The test name is the URL so a TAP `not ok` line names the endpoint.
    it(url, { timeout: LIVE_PROBE_TIMEOUT_MS * LIVE_PROBE_MAX_ATTEMPTS + 5_000 }, async () => {
      noteEndpoint(url);
      try {
        const result = await probeEndpoint(url);
        assert.ok(
          result.status >= 200 && result.status < 500,
          `HTTP ${result.status} from ${url} (modules: ${names.join(', ')})`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`${message} (modules: ${names.join(', ')})`);
      }
    });
  }
});
