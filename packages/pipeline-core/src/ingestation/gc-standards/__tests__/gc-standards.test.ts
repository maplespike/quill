// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GC_DEPARTMENTS, normalizeDepartment } from '../index.js';

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

  it('normalizeDepartment function exists', () => {
    assert.ok(typeof normalizeDepartment === 'function', 'normalizeDepartment must be exported');
  });

  it('normalizeDepartment handles department codes', () => {
    if (typeof normalizeDepartment === 'function') {
      const result = normalizeDepartment('dnd');
      assert.ok(result, 'normalizeDepartment must return a value');
    }
  });
});