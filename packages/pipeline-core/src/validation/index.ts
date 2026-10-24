// SPDX-License-Identifier: AGPL-3.0-only

export type {
  ValidationStatus,
  ValidationSeverity,
  ValidationFinding,
  SchemaDescriptor,
  SchemaField,
  ValidationResult,
  ValidationConfig,
  FieldValidator,
} from './types.js';

export {
  validateRecord,
  validateParserOutput,
  inferSchema,
  validateModule,
  validateAllModules,
} from './schema-validator.js';

export type {
  ModuleValidationReport,
} from './schema-validator.js';
