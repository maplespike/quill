// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Parser Validation Types — Quill
 *
 * Strongly-typed interfaces for validating parser output
 * against expected data source schemas.
 */

/** Status of a schema validation check. */
export type ValidationStatus = 'pass' | 'fail' | 'warn' | 'skip';

/** Severity for individual validation findings. */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/** A single validation finding (field-level check result). */
export interface ValidationFinding {
  /** Field name that was checked */
  field: string;
  /** What was checked */
  check: string;
  /** Result of the check */
  status: ValidationStatus;
  /** Severity if status is 'fail' or 'warn' */
  severity: ValidationSeverity;
  /** Human-readable description */
  message: string;
  /** Expected value or pattern */
  expected?: string;
  /** Actual value observed */
  actual?: string;
}

/** Schema descriptor for a module's expected output. */
export interface SchemaDescriptor {
  /** Module name (must match registry) */
  moduleName: string;
  /** Version of this schema (semver) */
  schemaVersion: string;
  /** Fields expected in parsed records */
  fields: SchemaField[];
  /** Timestamp when this schema was captured */
  capturedAt: string;
}

/** A single field in the schema descriptor. */
export interface SchemaField {
  /** Field name */
  name: string;
  /** Whether this field is required */
  required: boolean;
  /** Expected type: 'string', 'number', 'boolean', 'date', 'array', 'object' */
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  /** Expected format pattern (regex or well-known format name) */
  pattern?: string;
  /** Minimum value length or numeric value */
  minLength?: number;
  /** Maximum value length */
  maxLength?: number;
  /** Allowed values (enum) */
  enum?: string[];
  /** Description */
  description?: string;
}

/** Result of validating a parser's output against a schema. */
export interface ValidationResult {
  /** Module name */
  moduleName: string;
  /** Overall status: 'pass' if all required fields present, 'fail' otherwise */
  status: ValidationStatus;
  /** Schema version used */
  schemaVersion: string;
  /** Individual field findings */
  findings: ValidationFinding[];
  /** Timestamp */
  validatedAt: string;
  /** Duration in ms */
  durationMs: number;
  /** Summary counts */
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
}

/** Configuration for a validation run. */
export interface ValidationConfig {
  /** Fail on warnings (treat warn as fail) */
  strict?: boolean;
  /** Skip fields not in the schema (don't report as warn) */
  ignoreExtraFields?: boolean;
  /** Custom validators keyed by field name */
  customValidators?: Record<string, FieldValidator>;
}

/** Custom field validator function. */
export type FieldValidator = (
  value: unknown,
  field: SchemaField,
) => ValidationFinding | null;
