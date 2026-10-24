// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ingestion/who-gho', () => {
  // Module loading tests (standard pattern)
  it('constants module loads with correct exports', async () => {
    const constantsMod = await import('../constants.js');
    assert.ok(constantsMod, 'constants should load');
    assert.equal(typeof constantsMod, 'object', 'constants should be an object');
    assert.ok(Object.keys(constantsMod).length > 0, 'constants should export at least one value');
    assert.ok(constantsMod.WHO_GHO_API_URL, 'constants should export WHO_GHO_API_URL');
    assert.ok(constantsMod.DEFAULT_INDICATORS, 'constants should export DEFAULT_INDICATORS');
    assert.ok(Array.isArray(constantsMod.DEFAULT_INDICATORS), 'DEFAULT_INDICATORS should be array');
    assert.ok(constantsMod.DEFAULT_INDICATORS.length >= 10, 'DEFAULT_INDICATORS should have at least 10 indicators');
  });

  it('types module loads correctly', async () => {
    const typesMod = await import('../types.js');
    assert.ok(typesMod, 'types should load');
  });

  it('fetcher module loads and exports functions', async () => {
    const fetcherMod = await import('../fetcher.js');
    assert.ok(fetcherMod, 'fetcher should load');
    const keys = Object.keys(fetcherMod);
    assert.ok(keys.length > 0, 'fetcher should export at least one item');
    const nonFunctions = keys.filter((k) => typeof (fetcherMod as any)[k] !== 'function');
    assert.equal(nonFunctions.length, 0, `fetcher exports should all be functions: ${nonFunctions.join(', ')}`);
  });

  it('parser module loads and exports functions', async () => {
    const parserMod = await import('../parser.js');
    assert.ok(parserMod, 'parser should load');
    const keys = Object.keys(parserMod);
    assert.ok(keys.length > 0, 'parser should export at least one item');
    const nonFunctions = keys.filter((k) => typeof (parserMod as any)[k] !== 'function');
    assert.equal(nonFunctions.length, 0, `parser exports should all be functions: ${nonFunctions.join(', ')}`);
  });

  it('index module exports the expected public API', async () => {
    const indexMod = await import('../index.js');
    const keys = Object.keys(indexMod);
    assert.ok(keys.length > 0, 'index should export at least one item');
    keys.forEach((k) => {
      const type = typeof (indexMod as any)[k];
      assert.ok(
        type === 'function' || type === 'object' || type === 'string' || type === 'number',
        `${k} should be function, object, or string (got ${type})`,
      );
    });
    // Verify key functions exist
    assert.ok(typeof indexMod.ingestGhoIndicator === 'function', 'ingestGhoIndicator should be function');
    assert.ok(typeof indexMod.ingestAllGho === 'function', 'ingestAllGho should be function');
    assert.ok(typeof indexMod.searchGhoRecords === 'function', 'searchGhoRecords should be function');
    assert.ok(typeof indexMod.healthCheck === 'function', 'healthCheck should be function');
  });
});