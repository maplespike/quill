// SPDX-License-Identifier: AGPL-3.0-only

import type { TestResult } from './types.js';

export interface CrossReferenceCheck {
  moduleName: string;
  sourceField: string;
  targetModule: string;
  targetField: string;
  sourceValue: string;
  targetExists: boolean;
}

export function validateCrossReference(
  check: CrossReferenceCheck,
): TestResult {
  const start = Date.now();
  const testName = `xref:${check.moduleName}.${check.sourceField}→${check.targetModule}.${check.targetField}`;

  if (!check.sourceValue) {
    return {
      moduleName: check.moduleName,
      testName,
      status: 'skip',
      severity: 'info',
      message: `Empty reference value, skipping`,
      durationMs: Date.now() - start,
    };
  }

  if (!check.targetExists) {
    return {
      moduleName: check.moduleName,
      testName,
      status: 'fail',
      severity: 'error',
      message: `Broken reference: ${check.moduleName}.${check.sourceField}="${check.sourceValue}" → ${check.targetModule}.${check.targetField} not found`,
      durationMs: Date.now() - start,
      expected: `Target exists in ${check.targetModule}`,
      actual: check.sourceValue,
    };
  }

  return {
    moduleName: check.moduleName,
    testName,
    status: 'pass',
    severity: 'info',
    message: `Cross-reference OK: ${check.sourceValue} → ${check.targetModule}`,
    durationMs: Date.now() - start,
  };
}

export function validateCrossReferenceBatch(
  checks: CrossReferenceCheck[],
): TestResult[] {
  return checks.map(validateCrossReference);
}
