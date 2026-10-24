// SPDX-License-Identifier: AGPL-3.0-only

export type {
  TestSeverity,
  TestStatus,
  TestResult,
  TestSuiteResult,
  QASummary,
  ValidationRule,
  SchemaConstraint,
} from './types.js';

export {
  validateAgainstSchema,
  computeSuiteResult,
} from './data-validator.js';

export {
  verifyCitationHash,
  verifyCitationBatch,
} from './citation-validator.js';

export type { CitationCheckInput } from './citation-validator.js';

export {
  validateCrossReference,
  validateCrossReferenceBatch,
} from './cross-reference-validator.js';

export type { CrossReferenceCheck } from './cross-reference-validator.js';
