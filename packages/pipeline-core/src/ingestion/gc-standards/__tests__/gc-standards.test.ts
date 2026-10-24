// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GC_DEPARTMENTS } from '../index.js';

describe('GC Standards Module', () => {
  it('exports GC_DEPARTMENTS constant', () => {
    assert.ok(GC_DEPARTMENTS, 'GC_DEPARTMENTS must be exported');
    assert.ok(typeof GC_DEPARTMENTS === 'object', 'GC_DEPARTMENTS must be an object');
  });

  it('GC_DEPARTMENTS contains expected federal departments', () => {
    assert.ok(GC_DEPARTMENTS['esdc'], 'ESDC must be in departments');
    assert.ok(GC_DEPARTMENTS['dnd'], 'DND must be in departments');
    assert.ok(GC_DEPARTMENTS['stats'], 'Statistics Canada must be in departments');
    assert.ok(GC_DEPARTMENTS['ircc'], 'IRCC must be in departments');
  });

  it('GC_DEPARTMENTS has at least 50 entries', () => {
    const count = Object.keys(GC_DEPARTMENTS).length;
    assert.ok(count >= 50, `Expected at least 50 departments, got ${count}`);
  });

  it('department codes are lowercase', () => {
    for (const code of Object.keys(GC_DEPARTMENTS)) {
      assert.ok(code === code.toLowerCase(), `${code} must be lowercase`);
    }
  });
});