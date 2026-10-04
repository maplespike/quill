// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Schema Validator — Quill
 *
 * Validates parser output against expected data source schemas.
 * Detects when upstream schema changes break existing parsers.
 */

import type {
  SchemaDescriptor,
  SchemaField,
  ValidationConfig,
  ValidationFinding,
  ValidationResult,
  ValidationSeverity,
  ValidationStatus,
} from './types.js';
import { getAllModules } from '../ingestion/registry.js';
import { healthCheckModule } from '../ingestion/registry.js';


const TYPE_CHECKS: Record<SchemaField['type'], (v: unknown) => boolean> = {
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && !isNaN(v),
  boolean: (v) => typeof v === 'boolean',
  date: (v) => typeof v === 'string' && !isNaN(Date.parse(v)),
  array: (v) => Array.isArray(v),
  object: (v) => typeof v === 'object' && v !== null && !Array.isArray(v),
};

function checkField(
  value: unknown,
  field: SchemaField,
  config: ValidationConfig,
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const present = value !== undefined && value !== null;

  if (field.required && !present) {
    findings.push({
      field: field.name,
      check: 'required',
      status: 'fail',
      severity: 'error',
      message: `Required field "${field.name}" is missing`,
      expected: field.type,
      actual: String(value),
    });
    return findings;
  }

  if (!present) {
    findings.push({
      field: field.name,
      check: 'optional-presence',
      status: 'skip',
      severity: 'info',
      message: `Optional field "${field.name}" is absent`,
    });
    return findings;
  }

  const typeCheck = TYPE_CHECKS[field.type];
  if (typeCheck && !typeCheck(value)) {
    findings.push({
      field: field.name,
      check: 'type',
      status: 'fail',
      severity: 'error',
      message: `Field "${field.name}" has wrong type`,
      expected: field.type,
      actual: typeof value,
    });
    return findings;
  }

  if (field.pattern && typeof value === 'string') {
    try {
      const re = new RegExp(field.pattern);
      if (!re.test(value)) {
        findings.push({
          field: field.name,
          check: 'pattern',
          status: 'fail',
          severity: 'warning',
          message: `Field "${field.name}" doesn't match pattern`,
          expected: field.pattern,
          actual: value.substring(0, 100),
        });
      }
    } catch {
      // Invalid regex in schema — skip pattern check
    }
  }

  if (field.minLength !== undefined && typeof value === 'string' && value.length < field.minLength) {
    findings.push({
      field: field.name,
      check: 'minLength',
      status: 'fail',
      severity: 'warning',
      message: `Field "${field.name}" shorter than minLength`,
      expected: `>= ${field.minLength}`,
      actual: String(value.length),
    });
  }

  if (field.maxLength !== undefined && typeof value === 'string' && value.length > field.maxLength) {
    findings.push({
      field: field.name,
      check: 'maxLength',
      status: 'warn',
      severity: 'warning',
      message: `Field "${field.name}" exceeds maxLength`,
      expected: `<= ${field.maxLength}`,
      actual: String(value.length),
    });
  }

  if (field.enum && !field.enum.includes(String(value))) {
    findings.push({
      field: field.name,
      check: 'enum',
      status: 'fail',
      severity: 'warning',
      message: `Field "${field.name}" not in allowed values`,
      expected: field.enum.join('|'),
      actual: String(value),
    });
  }

  if (findings.length === 0) {
    findings.push({
      field: field.name,
      check: 'all',
      status: 'pass',
      severity: 'info',
      message: `Field "${field.name}" passes all checks`,
    });
  }

  return findings;
}

export function validateRecord(
  record: Record<string, unknown>,
  schema: SchemaDescriptor,
  config: ValidationConfig = {},
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  for (const field of schema.fields) {
    const value = record[field.name];
    const customValidator = config.customValidators?.[field.name];
    if (customValidator) {
      const result = customValidator(value, field);
      if (result) findings.push(result);
    } else {
      findings.push(...checkField(value, field, config));
    }
  }

  if (!config.ignoreExtraFields) {
    const schemaFieldNames = new Set(schema.fields.map(f => f.name));
    for (const key of Object.keys(record)) {
      if (!schemaFieldNames.has(key)) {
        findings.push({
          field: key,
          check: 'extra-field',
          status: 'warn',
          severity: 'info',
          message: `Extra field "${key}" not in schema`,
        });
      }
    }
  }

  return findings;
}

export function validateParserOutput(
  moduleName: string,
  records: Record<string, unknown>[],
  schema: SchemaDescriptor,
  config: ValidationConfig = {},
): ValidationResult {
  const startTime = Date.now();
  const allFindings: ValidationFinding[] = [];

  for (const record of records) {
    allFindings.push(...validateRecord(record, schema, config));
  }

  const summary = {
    total: allFindings.length,
    passed: allFindings.filter(f => f.status === 'pass').length,
    failed: allFindings.filter(f => f.status === 'fail').length,
    warnings: allFindings.filter(f => f.status === 'warn').length,
    skipped: allFindings.filter(f => f.status === 'skip').length,
  };

  const hasErrors = summary.failed > 0;
  const hasWarnAsError = config.strict && summary.warnings > 0;
  const status: ValidationStatus = (hasErrors || hasWarnAsError) ? 'fail' : 'pass';

  return {
    moduleName,
    status,
    schemaVersion: schema.schemaVersion,
    findings: allFindings,
    validatedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    summary,
  };
}

export function inferSchema(
  moduleName: string,
  records: Record<string, unknown>[],
): SchemaDescriptor {
  const fieldMap = new Map<string, { types: Set<string>; required: boolean; samples: unknown[] }>();

  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (!fieldMap.has(key)) {
        fieldMap.set(key, { types: new Set(), required: true, samples: [] });
      }
      const entry = fieldMap.get(key)!;
      entry.types.add(typeof value);
      if (value === undefined || value === null) {
        entry.required = false;
      }
      if (entry.samples.length < 5) {
        entry.samples.push(value);
      }
    }
    for (const [name, entry] of fieldMap) {
      if (!(name in record)) {
        entry.required = false;
      }
    }
  }

  const fields: SchemaField[] = [];
  for (const [name, entry] of fieldMap) {
    const type = entry.types.values().next().value as SchemaField['type'] ?? 'string';
    fields.push({
      name,
      required: entry.required,
      type: type === 'object' && entry.samples.some(s => Array.isArray(s)) ? 'array' : type,
    });
  }

  return {
    moduleName,
    schemaVersion: '1.0.0',
    fields,
    capturedAt: new Date().toISOString(),
  };
}

export interface ModuleValidationReport {
  moduleName: string;
  upstreamHealthy: boolean;
  parserValid: boolean;
  schemaDriftDetected: boolean;
  validationResult?: ValidationResult;
  error?: string;
}

export async function validateModule(
  moduleName: string,
  sampleRecords: Record<string, unknown>[],
  schema?: SchemaDescriptor,
  config: ValidationConfig = {},
): Promise<ModuleValidationReport> {
  const mod = getAllModules().find(m => m.name === moduleName);
  if (!mod) {
    return {
      moduleName,
      upstreamHealthy: false,
      parserValid: false,
      schemaDriftDetected: false,
      error: `Module "${moduleName}" not found in registry`,
    };
  }

  const upstreamHealthy = await healthCheckModule(mod);

  if (sampleRecords.length === 0) {
    return {
      moduleName,
      upstreamHealthy,
      parserValid: true,
      schemaDriftDetected: false,
      error: 'No sample records provided — validation skipped',
    };
  }

  const effectiveSchema = schema ?? inferSchema(moduleName, sampleRecords);
  const result = validateParserOutput(moduleName, sampleRecords, effectiveSchema, config);

  return {
    moduleName,
    upstreamHealthy,
    parserValid: result.status === 'pass',
    schemaDriftDetected: result.summary.failed > 0,
    validationResult: result,
  };
}

export async function validateAllModules(
  moduleRecords: Record<string, Record<string, unknown>[]>,
  schemas?: Record<string, SchemaDescriptor>,
  config: ValidationConfig = {},
): Promise<ModuleValidationReport[]> {
  const results: ModuleValidationReport[] = [];
  for (const [moduleName, records] of Object.entries(moduleRecords)) {
    const schema = schemas?.[moduleName];
    results.push(await validateModule(moduleName, records, schema, config));
  }
  return results;
}
