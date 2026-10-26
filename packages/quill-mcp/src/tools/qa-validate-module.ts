// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { validateAgainstSchema, computeSuiteResult } from '@maplespike/pipeline-core/test-framework';
import type { SchemaConstraint } from '@maplespike/pipeline-core/test-framework';

export const definition: ToolDefinition = {
  name: 'qa_validate_module',
  description:
    'Run data integrity validation on an ingestion module. ' +
    'Checks required fields, types, ranges, string lengths, and enum values ' +
    'against the module schema. Returns pass/fail results per field. ' +
    'Use this to verify data quality before or after ingestion.',
  inputSchema: {
    type: 'object',
    properties: {
      moduleName: {
        type: 'string',
        maxLength: 500,
description: 'Module name (e.g., "committees", "gic", "rss")',
      },
      records: {
        type: 'array',
        items: { type: 'object' },
        description: 'Array of records to validate. Each record is a key-value object.',
      },
      constraints: {
        type: 'array',
        items: { type: 'object' },
        description: 'Optional schema constraints. Auto-derived if omitted.',
      },
    },
    required: ['moduleName', 'records'],
  },
};

const FALLBACK_CONSTRAINTS: Record<string, SchemaConstraint[]> = {
  default: [
    { field: 'id', required: true, type: 'string', minLength: 1 },
    { field: 'name', required: true, type: 'string', minLength: 1 },
    { field: 'sourceUrl', type: 'string' },
    { field: 'sourceSystem', type: 'string' },
    { field: 'ingestedAt', type: 'string', pattern: /^\d{4}-\d{2}-\d{2}T/ },
  ],
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  try {
    const moduleName = String(args.moduleName ?? '');
    const records = args.records as Record<string, unknown>[];
    const customConstraints = args.constraints as SchemaConstraint[] | undefined;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return {
        content: { tool: 'qa_validate_module', status: 'error', message: 'No records provided' },
        isError: true,
      };
    }

    const constraints = customConstraints ?? FALLBACK_CONSTRAINTS.default;
    const startTime = Date.now();
    const allResults = records.flatMap(r => validateAgainstSchema(r, constraints, moduleName));
    const suite = computeSuiteResult(moduleName, allResults, startTime);

    return {
      content: {
        tool: 'qa_validate_module',
        moduleName,
        recordsChecked: records.length,
        suite: {
          total: suite.total,
          passed: suite.passed,
          failed: suite.failed,
          durationMs: suite.durationMs,
        },
        failures: allResults.filter(r => r.status === 'fail').map(r => ({
          test: r.testName,
          message: r.message,
          expected: r.expected,
          actual: r.actual,
        })),
        timestamp: suite.timestamp,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'qa_validate_module',
        status: 'error',
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};
