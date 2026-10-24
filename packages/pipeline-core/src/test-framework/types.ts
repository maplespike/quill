// SPDX-License-Identifier: AGPL-3.0-only

export type TestSeverity = 'error' | 'warning' | 'info';

export type TestStatus = 'pass' | 'fail' | 'skip' | 'error';

export interface TestResult {
  moduleName: string;
  testName: string;
  status: TestStatus;
  severity: TestSeverity;
  message: string;
  durationMs: number;
  expected?: unknown;
  actual?: unknown;
}

export interface TestSuiteResult {
  moduleName: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  durationMs: number;
  results: TestResult[];
  timestamp: string;
}

export interface QASummary {
  totalModules: number;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  coverage: number;
  lastRunAt: string | null;
  suites: TestSuiteResult[];
}

export interface ValidationRule {
  name: string;
  description: string;
  severity: TestSeverity;
  validate: (record: Record<string, unknown>) => Promise<TestResult | null>;
}

export interface SchemaConstraint {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: unknown[];
}
