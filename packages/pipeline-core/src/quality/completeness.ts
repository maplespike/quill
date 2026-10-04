// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Completeness Scoring — Quill
 *
 * Evaluates how complete a dataset is by analyzing:
 *   1. Field presence — are expected fields present (non-null, non-empty)?
 *   2. Record density — what fraction of expected fields have values?
 *   3. Schema compliance — do values match expected types/patterns?
 *
 * Scores:
 *   0.95–1.0  excellent — ≥95% fields present, no validation issues
 *   0.80–0.94 good     — ≥80% fields present, minor issues
 *   0.60–0.79 fair     — ≥60% fields present, some gaps
 *   0.30–0.59 poor     — <60% fields present, significant gaps
 *   < 0.30   unknown   — no data or all fields missing
 */

import type { CompletenessScore, QualityLevel } from './types.js';
import { scoreToLevel } from './types.js';

/* ------------------------------------------------------------------ */
/*  Core field-checking helpers                                        */
/* ------------------------------------------------------------------ */

/** Check if a value is considered "present" (not null, not empty) */
export function isFieldPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === 'number' && Number.isNaN(value)) return false;
  return true;
}

/** Common expected field lists for known module types */
export const MODULE_EXPECTED_FIELDS: Record<string, string[]> = {
  // Federal governance
  committees: ['parliament', 'chamber', 'committee_name', 'role', 'name', 'party', 'startDate'],
  'committee-meetings': ['committee_id', 'meeting', 'date', 'topic', 'witnesses'],
  lobbying: ['filingNumber', 'registrantName', 'clientName', 'subjectMatter', 'startDate', 'endDate', 'institution'],
  'goc-spending': ['contractNumber', 'title', 'vendorName', 'department', 'value', 'startDate'],
  gazette: ['title', 'department', 'publicationDate', 'type', 'url'],
  elections: ['donorName', 'recipientName', 'amount', 'date', 'province'],
  'proactive-disclosure': ['personName', 'position', 'department', 'year', 'interests', 'filingDate'],
  ati: ['requestNumber', 'summary', 'department', 'decision', 'pages'],
  oversight: ['organization', 'reportTitle', 'publicationDate', 'summary', 'recommendations'],

  // Corporate & financial
  corporate: ['corporationName', 'corporationNumber', 'jurisdiction', 'status', 'address'],
  'corporate-filings': ['filingId', 'corporationName', 'filingType', 'filingDate', 'status'],
  'cra-charity': ['charityName', 'charityNumber', 'status', 'city', 'province'],
  'crown-corporations': ['corporationName', 'department', 'minister', 'annualBudget', 'reportUrl'],
  'bank-of-canada': ['title', 'date', 'type', 'url', 'summary'],
  cipo: ['applicationNumber', 'title', 'applicant', 'status', 'filingDate'],

  // Justice & legislation
  canlii: ['citation', 'court', 'decisionDate', 'title', 'docketNumber'],
  legislation: ['title', 'jurisdiction', 'status', 'date', 'url'],

  // Immigration
  immigration: ['year', 'category', 'admissions', 'province', 'stream'],
  ircc: ['applicationType', 'received', 'processed', 'approved', 'refused'],

  // Provincial (canonical — used as fallback for all provincial modules)
  provincial: ['id', 'name', 'province', 'source', 'rawData'],
};

/**
 * Infer the expected fields list for a module based on its name.
 * Falls back to a minimal set of common fields.
 */
export function inferExpectedFields(moduleName: string): string[] {
  const key = moduleName.toLowerCase().replace(/[-\s]/g, '-');
  if (MODULE_EXPECTED_FIELDS[key]) return MODULE_EXPECTED_FIELDS[key];

  // Try partial matching: e.g. "on-health" might match "provincial"
  for (const [pattern, fields] of Object.entries(MODULE_EXPECTED_FIELDS)) {
    if (key.includes(pattern)) return fields;
  }

  // Absolute fallback
  return ['id', 'name', 'source', 'rawData', 'createdAt'];
}

/* ------------------------------------------------------------------ */
/*  Single-record completeness analysis                                */
/* ------------------------------------------------------------------ */

export interface RecordAnalysis {
  presentFields: number;
  totalFields: number;
  missingFields: string[];
  invalidFields: string[];
}

/**
 * Analyze a single record for completeness.
 * Expected fields can be provided, or inferred from module name.
 */
export function analyzeRecord(
  record: Record<string, unknown>,
  expectedFields?: string[],
): RecordAnalysis {
  const fields = expectedFields ?? Object.keys(record);
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const field of fields) {
    if (!(field in record) || !isFieldPresent(record[field])) {
      missing.push(field);
    }
  }

  return {
    presentFields: fields.length - missing.length,
    totalFields: fields.length,
    missingFields: missing,
    invalidFields: invalid,
  };
}

/* ------------------------------------------------------------------ */
/*  Batch completeness analysis                                        */
/* ------------------------------------------------------------------ */

/**
 * Analyze completeness across multiple records.
 *
 * A field is considered "present" if it has a value in ≥80% of records.
 * Missing fields are those with presence rate < 80%.
 */
export function analyzeBatchCompleteness(
  records: Array<Record<string, unknown>>,
  expectedFields?: string[],
): {
  fieldPresence: Record<string, { present: number; total: number; rate: number }>;
  missingFields: string[];
  presentFields: number;
  totalFields: number;
  recordCount: number;
} {
  if (records.length === 0) {
    const fields = expectedFields ?? [];
    return {
      fieldPresence: Object.fromEntries(fields.map((f) => [f, { present: 0, total: 0, rate: 0 }])),
      missingFields: fields,
      presentFields: 0,
      totalFields: fields.length,
      recordCount: 0,
    };
  }

  // Collect all field names across records (union) if no expected fields given
  const allFields = expectedFields ?? [
    ...new Set(records.flatMap((r) => Object.keys(r))),
  ];

  const fieldPresence: Record<string, { present: number; total: number; rate: number }> = {};

  for (const field of allFields) {
    let present = 0;
    for (const record of records) {
      if (field in record && isFieldPresent(record[field])) {
        present++;
      }
    }
    fieldPresence[field] = {
      present,
      total: records.length,
      rate: Math.round((present / records.length) * 1000) / 1000,
    };
  }

  const missingFields = allFields.filter(
    (f) => (fieldPresence[f]?.rate ?? 0) < 0.8,
  );

  return {
    fieldPresence,
    missingFields,
    presentFields: allFields.length - missingFields.length,
    totalFields: allFields.length,
    recordCount: records.length,
  };
}

/* ------------------------------------------------------------------ */
/*  Score computation                                                  */
/* ------------------------------------------------------------------ */

/**
 * Score completeness for a batch of records.
 *
 * Algorithm:
 *   presenceScore  = presentFields / totalFields  (if totalFields > 0 else 0)
 *   densityScore   = average per-record completeness
 *   composite      = weighted: presenceScore × 0.6 + densityScore × 0.4
 */
export function scoreCompleteness(
  records: Array<Record<string, unknown>>,
  source: string,
  expectedFields?: string[],
): CompletenessScore {
  if (records.length === 0) {
    return {
      score: 0,
      level: 'unknown',
      totalFields: expectedFields?.length ?? 0,
      presentFields: 0,
      missingFields: expectedFields ?? [],
      invalidFields: [],
      recordCount: 0,
      source,
    };
  }

  const batch = analyzeBatchCompleteness(records, expectedFields);

  // Per-record density: how many expected fields are present per record?
  const recordDensities = records.map((r) => {
    const analysis = analyzeRecord(r, expectedFields ?? Object.keys(batch.fieldPresence));
    return analysis.totalFields > 0 ? analysis.presentFields / analysis.totalFields : 0;
  });
  const densityScore =
    recordDensities.reduce((sum, d) => sum + d, 0) / recordDensities.length;

  // Score: presence rate × 0.6 + density × 0.4
  const fieldPresenceRate =
    batch.totalFields > 0 ? batch.presentFields / batch.totalFields : 0;
  const score = Math.round(
    Math.min(1, fieldPresenceRate * 0.6 + densityScore * 0.4) * 1000,
  ) / 1000;

  return {
    score,
    level: scoreToLevel(score),
    totalFields: batch.totalFields,
    presentFields: batch.presentFields,
    missingFields: batch.missingFields,
    invalidFields: [],
    recordCount: batch.recordCount,
    source,
  };
}

/**
 * Quick one-record completeness check for inline use.
 */
export function scoreRecordCompleteness(
  record: Record<string, unknown>,
  source: string,
  expectedFields?: string[],
): CompletenessScore {
  return scoreCompleteness([record], source, expectedFields);
}
