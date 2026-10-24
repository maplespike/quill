// SPDX-License-Identifier: AGPL-3.0-only

import type { TestResult, SchemaConstraint, TestSuiteResult } from './types.js';

export function validateAgainstSchema(
  record: Record<string, unknown>,
  constraints: SchemaConstraint[],
  moduleName: string,
): TestResult[] {
  const results: TestResult[] = [];

  for (const c of constraints) {
    const value = record[c.field];
    const start = Date.now();

    // Required field check
    if (c.required && (value === undefined || value === null || value === '')) {
      results.push({
        moduleName,
        testName: `required_field:${c.field}`,
        status: 'fail',
        severity: 'error',
        message: `Required field "${c.field}" is missing or empty`,
        durationMs: Date.now() - start,
        expected: 'present',
        actual: value,
      });
      continue;
    }

    if (value === undefined || value === null) continue;

    // Type check
    if (c.type && typeof value !== c.type) {
      // Special case: number can be string that parses as number
      if (c.type === 'number' && typeof value === 'string' && !isNaN(Number(value))) {
        // acceptable
      } else {
        results.push({
          moduleName,
          testName: `type_check:${c.field}`,
          status: 'fail',
          severity: 'error',
          message: `Field "${c.field}" expected ${c.type}, got ${typeof value}`,
          durationMs: Date.now() - start,
          expected: c.type,
          actual: typeof value,
        });
        continue;
      }
    }

    // String constraints
    if (typeof value === 'string') {
      if (c.minLength !== undefined && value.length < c.minLength) {
        results.push({
          moduleName,
          testName: `min_length:${c.field}`,
          status: 'fail',
          severity: 'warning',
          message: `Field "${c.field}" too short (${value.length} < ${c.minLength})`,
          durationMs: Date.now() - start,
          expected: `>= ${c.minLength}`,
          actual: value.length,
        });
      }
      if (c.maxLength !== undefined && value.length > c.maxLength) {
        results.push({
          moduleName,
          testName: `max_length:${c.field}`,
          status: 'fail',
          severity: 'warning',
          message: `Field "${c.field}" too long (${value.length} > ${c.maxLength})`,
          durationMs: Date.now() - start,
          expected: `<= ${c.maxLength}`,
          actual: value.length,
        });
      }
      if (c.pattern && !c.pattern.test(value)) {
        results.push({
          moduleName,
          testName: `pattern:${c.field}`,
          status: 'fail',
          severity: 'warning',
          message: `Field "${c.field}" does not match pattern ${c.pattern}`,
          durationMs: Date.now() - start,
          expected: c.pattern.toString(),
          actual: value,
        });
      }
    }

    // Numeric constraints
    if (typeof value === 'number') {
      if (c.min !== undefined && value < c.min) {
        results.push({
          moduleName,
          testName: `min_value:${c.field}`,
          status: 'fail',
          severity: 'warning',
          message: `Field "${c.field}" below minimum (${value} < ${c.min})`,
          durationMs: Date.now() - start,
          expected: `>= ${c.min}`,
          actual: value,
        });
      }
      if (c.max !== undefined && value > c.max) {
        results.push({
          moduleName,
          testName: `max_value:${c.field}`,
          status: 'fail',
          severity: 'warning',
          message: `Field "${c.field}" above maximum (${value} > ${c.max})`,
          durationMs: Date.now() - start,
          expected: `<= ${c.max}`,
          actual: value,
        });
      }
    }

    // Enum check
    if (c.enum && !c.enum.includes(value)) {
      results.push({
        moduleName,
        testName: `enum:${c.field}`,
        status: 'fail',
        severity: 'warning',
        message: `Field "${c.field}" value "${value}" not in allowed set`,
        durationMs: Date.now() - start,
        expected: c.enum,
        actual: value,
      });
    }
  }

  return results;
}

export function computeSuiteResult(
  moduleName: string,
  allResults: TestResult[],
  startTime: number,
): TestSuiteResult {
  const passed = allResults.filter(r => r.status === 'pass').length;
  const failed = allResults.filter(r => r.status === 'fail').length;
  const skipped = allResults.filter(r => r.status === 'skip').length;
  const errors = allResults.filter(r => r.status === 'error').length;

  return {
    moduleName,
    total: allResults.length,
    passed,
    failed,
    skipped,
    errors,
    durationMs: Date.now() - startTime,
    results: allResults,
    timestamp: new Date().toISOString(),
  };
}
