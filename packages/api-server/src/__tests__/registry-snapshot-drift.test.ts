// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAllModules } from '../registry-snapshot.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// registry-snapshot.ts is a manual mirror of pipeline-core's registry.ts
// (kept in sync by hand to avoid the circular import). This test guards
// against drift: every modulePath in the snapshot must resolve to a real
// module file under pipeline-core/src/ingestion/. Without this, a module
// removed from pipeline-core but left in the snapshot would advertise a
// loader path that 404s at runtime (e.g. the eurostat entry in 2026-08).
// From src/__tests__/: ../../../ = packages/, then pipeline-core/src/ingestion.
const PIPELINE_INGESTION_DIR = resolve(
  __dirname,
  '../../../pipeline-core/src/ingestion',
);

function resolveModulePath(modulePath: string): string | null {
  // './eurostat/index.js' -> <ingestion>/eurostat/index.ts
  const relative = modulePath.replace(/^\.\//, '').replace(/\.js$/, '.ts');
  const candidate = join(PIPELINE_INGESTION_DIR, relative);
  if (existsSync(candidate)) return candidate;
  // Some entries are direct files ('./rss.js' -> <ingestion>/rss.ts).
  return null;
}

describe('registry-snapshot drift guard', () => {
  it('every modulePath resolves to a real pipeline-core ingestion module', () => {
    const modules = getAllModules();
    assert.ok(modules.length >= 100, `expected 100+ modules, got ${modules.length}`);
    const missing: string[] = [];
    for (const mod of modules) {
      if (!resolveModulePath(mod.modulePath)) {
        missing.push(`${mod.name} -> ${mod.modulePath}`);
      }
    }
    assert.deepEqual(
      missing,
      [],
      `snapshot entries without a matching pipeline-core module:\n${missing.join('\n')}`,
    );
  });

  it('snapshot module names are unique', () => {
    const names = getAllModules().map((m) => m.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    assert.deepEqual(dupes, [], `duplicate module names in snapshot: ${dupes.join(', ')}`);
  });
});
