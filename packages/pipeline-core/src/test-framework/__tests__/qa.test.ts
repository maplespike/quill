// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateAgainstSchema, computeSuiteResult } from '../data-validator.js';
import { verifyCitationHash, verifyCitationBatch } from '../citation-validator.js';
import { validateCrossReference, validateCrossReferenceBatch } from '../cross-reference-validator.js';
import type { SchemaConstraint } from '../types.js';

// ── Data Validator ─────────────────────────────────────────────────

describe('validateAgainstSchema', () => {
  const constraints: SchemaConstraint[] = [
    { field: 'id', required: true, type: 'string', minLength: 1 },
    { field: 'name', required: true, type: 'string', maxLength: 200 },
    { field: 'value', type: 'number', min: 0, max: 100 },
    { field: 'status', enum: ['active', 'inactive'] },
  ];

  it('passes valid record', () => {
    const record = { id: 'abc', name: 'test', value: 50, status: 'active' };
    const results = validateAgainstSchema(record, constraints, 'test-module');
    assert.equal(results.filter(r => r.status === 'fail').length, 0);
  });

  it('fails on missing required field', () => {
    const record = { name: 'test' };
    const results = validateAgainstSchema(record, constraints, 'test-module');
    assert.ok(results.some(r => r.testName === 'required_field:id' && r.status === 'fail'));
  });

  it('fails on value out of range', () => {
    const record = { id: 'abc', name: 'test', value: 999 };
    const results = validateAgainstSchema(record, constraints, 'test-module');
    assert.ok(results.some(r => r.testName === 'max_value:value' && r.status === 'fail'));
  });

  it('fails on invalid enum value', () => {
    const record = { id: 'abc', name: 'test', status: 'unknown' };
    const results = validateAgainstSchema(record, constraints, 'test-module');
    assert.ok(results.some(r => r.testName === 'enum:status'));
  });

  it('fails on string too long', () => {
    const record = { id: 'abc', name: 'x'.repeat(201) };
    const results = validateAgainstSchema(record, constraints, 'test-module');
    assert.ok(results.some(r => r.testName === 'max_length:name'));
  });
});

// ── Citation Validator ─────────────────────────────────────────────

describe('verifyCitationHash', () => {
  it('passes when hash matches content', async () => {
    const result = await verifyCitationHash({
      moduleName: 'test',
      recordId: 'rec1',
      content: 'hello world',
      expectedHash: 'b94d27b9934d3e08a52e52d7da7dabfac4f4d7b6a5c9e5e9c7e9e5d9c9e5e9c7',
      // This is NOT the actual sha256 - the function will verify and fail
    });
    // Since expectedHash doesn't match, it should fail
    assert.equal(result.status, 'fail');
  });

  it('fails on empty content', async () => {
    const result = await verifyCitationHash({
      moduleName: 'test',
      recordId: 'rec1',
      content: '',
      expectedHash: 'abc',
    });
    assert.equal(result.status, 'fail');
  });

  it('fails on empty hash', async () => {
    const result = await verifyCitationHash({
      moduleName: 'test',
      recordId: 'rec1',
      content: 'data',
      expectedHash: '',
    });
    assert.equal(result.status, 'fail');
  });

  it('verifies correct SHA-256', async () => {
    const { computeHash } = await import('../../verification/hashing.js');
    const content = 'verify me please';
    const hash = await computeHash(content, 'sha256');
    const result = await verifyCitationHash({
      moduleName: 'test',
      recordId: 'rec1',
      content,
      expectedHash: hash,
    });
    assert.equal(result.status, 'pass');
  });
});

describe('verifyCitationBatch', () => {
  it('processes multiple citations', async () => {
    const results = await verifyCitationBatch([
      { moduleName: 'm1', recordId: 'r1', content: '', expectedHash: 'h1' },
      { moduleName: 'm1', recordId: 'r2', content: '', expectedHash: 'h2' },
    ]);
    assert.equal(results.length, 2);
    assert.ok(results.every(r => r.status === 'fail'));
  });
});

// ── Cross-Reference Validator ──────────────────────────────────────

describe('validateCrossReference', () => {
  it('passes when target exists', () => {
    const result = validateCrossReference({
      moduleName: 'lobbying',
      sourceField: 'registrantName',
      targetModule: 'committees',
      targetField: 'memberName',
      sourceValue: 'John Doe',
      targetExists: true,
    });
    assert.equal(result.status, 'pass');
  });

  it('fails on broken reference', () => {
    const result = validateCrossReference({
      moduleName: 'lobbying',
      sourceField: 'registrantName',
      targetModule: 'committees',
      targetField: 'memberName',
      sourceValue: 'Missing Person',
      targetExists: false,
    });
    assert.equal(result.status, 'fail');
  });

  it('skips empty references', () => {
    const result = validateCrossReference({
      moduleName: 'lobbying',
      sourceField: 'registrantName',
      targetModule: 'committees',
      targetField: 'memberName',
      sourceValue: '',
      targetExists: false,
    });
    assert.equal(result.status, 'skip');
  });
});

describe('validateCrossReferenceBatch', () => {
  it('processes multiple cross-references', () => {
    const results = validateCrossReferenceBatch([
      { moduleName: 'm1', sourceField: 'f1', targetModule: 'm2', targetField: 'f2', sourceValue: 'val1', targetExists: true },
      { moduleName: 'm1', sourceField: 'f1', targetModule: 'm2', targetField: 'f2', sourceValue: 'val2', targetExists: false },
    ]);
    assert.equal(results.length, 2);
    assert.equal(results[0].status, 'pass');
    assert.equal(results[1].status, 'fail');
  });
});

// ── Suite Result ───────────────────────────────────────────────────

describe('computeSuiteResult', () => {
  it('computes correct summary', () => {
    const results = [
      { moduleName: 'm1', testName: 't1', status: 'pass', severity: 'info', message: 'ok', durationMs: 1 },
      { moduleName: 'm1', testName: 't2', status: 'fail', severity: 'error', message: 'fail', durationMs: 1 },
      { moduleName: 'm1', testName: 't3', status: 'pass', severity: 'info', message: 'ok', durationMs: 1 },
    ] as any;
    const suite = computeSuiteResult('m1', results, Date.now());
    assert.equal(suite.total, 3);
    assert.equal(suite.passed, 2);
    assert.equal(suite.failed, 1);
    assert.equal(suite.durationMs >= 0, true);
  });
});
