// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const DIR = new URL('../', import.meta.url).pathname;

describe('Pipeline Core Module Registry', () => {
  it('has at least 50 module directories', () => {
    const entries = fs.readdirSync(DIR, { withFileTypes: true });
    const modules = entries.filter(e => e.isDirectory() && !e.name.startsWith('__') && e.name !== 'fetchers');
    assert.ok(modules.length >= 50, `Found ${modules.length} modules`);
  });

  it('core modules have index.ts with exports', () => {
    const core = ['immigration', 'committees', 'corporate', 'influence', 'gazette', 'gic', 'lmia', 'oversight', 'canlii', 'defence', 'veterans', 'fisheries', 'agriculture', 'culture', 'indigenous-relations', 'criminal-justice', 'transport-infrastructure'];
    for (const m of core) {
      const p = path.join(DIR, m, 'index.ts');
      assert.ok(fs.existsSync(p), `${m} missing index.ts`);
      const c = fs.readFileSync(p, 'utf-8');
      assert.ok(c.includes('export'), `${m}/index.ts missing exports`);
    }
  });

  it('core modules have either search or ingest function exported', () => {
    const core = ['immigration', 'committees', 'corporate', 'influence', 'gazette', 'oversight', 'lmia', 'canlii'];
    for (const m of core) {
      const p = path.join(DIR, m, 'index.ts');
      const c = fs.readFileSync(p, 'utf-8');
      const hasIngest = c.includes('ingestAll') || c.includes('ingest');
      const hasSearch = c.includes('search');
      assert.ok(hasIngest || hasSearch, `${m}/index.ts missing ingest or search functions`);
    }
  });
});
