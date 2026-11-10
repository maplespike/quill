// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('undp-hdi Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.fetchHDIByCountry, 'function');
    assert.equal(typeof mod.fetchAllHDIData, 'function');
  });

  it('classifyHDI works correctly', async () => {
    const { classifyHDI } = await import('../parser.js');
    assert.equal(classifyHDI(0.950), 'very-high');
    assert.equal(classifyHDI(0.750), 'high');
    assert.equal(classifyHDI(0.650), 'medium');
    assert.equal(classifyHDI(0.450), 'low');
  });

  it('parser returns null for null HDI value', async () => {
    const { parseHDIRanking } = await import('../parser.js');
    const result = parseHDIRanking('CAN', null, null, 2022);
    assert.equal(result, null);
  });
});
