/**
 * Impact Assessment Agency of Canada Parser — Quill
 *
 * Normalizes raw IAAC records from the project registry, CKAN, and HTML
 * scraping into the unified ImpactAssessmentRecord schema.
 *
 * Each record represents a single federal project impact assessment
 * with its regulatory decision and associated documents.
 */

import { computeHash } from '../../verification/hashing.js';
import {
  IAAC_DECISION_MAP,
  IAAC_ASSESSMENT_TYPE_MAP,
} from './constants.js';
import type {
  ImpactAssessmentRecord,
  ImpactAssessmentDecision,
  AssessmentType,
  RawImpactAssessmentRecord,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Decision Normalization                                             */
/* ------------------------------------------------------------------ */

/**
 * Normalize a raw decision string to the unified ImpactAssessmentDecision type.
 */
export function normalizeDecision(raw: string | null | undefined): ImpactAssessmentDecision {
  if (!raw) return 'unknown';

  const trimmed = raw.trim().toLowerCase();

  // Direct map match
  const mapped = IAAC_DECISION_MAP[trimmed];
  if (mapped) return mapped;

  // Partial matching
  if (trimmed.includes('approved') && trimmed.includes('condition')) return 'approved-with-conditions';
  if (trimmed.includes('approved')) return 'approved';
  if (trimmed.includes('denied') || trimmed.includes('not approved')) return 'denied';
  if (trimmed.includes('pending') || trimmed.includes('in progress') || trimmed.includes('under review')) return 'pending';
  if (trimmed.includes('withdrawn')) return 'withdrawn';
  if (trimmed.includes('exempt')) return 'exempted';
  if (trimmed.includes('referred') || trimmed.includes('panel')) return 'referred';
  if (trimmed.includes('not required') || trimmed.includes('not needed')) return 'not-required';

  return 'unknown';
}

/**
 * Normalize a raw assessment type string to the unified AssessmentType.
 */
export function normalizeAssessmentType(raw: string | null | undefined): AssessmentType {
  if (!raw) return 'unknown';

  const trimmed = raw.trim().toLowerCase();

  const mapped = IAAC_ASSESSMENT_TYPE_MAP[trimmed];
  if (mapped) return mapped;

  if (trimmed.includes('impact assessment act') || trimmed.includes('iaa')) return 'iaa';
  if (trimmed.includes('ceaa 2012') || trimmed.includes('ceaa')) return 'ceaa-2012';
  if (trimmed.includes('panel') || trimmed.includes('review panel')) return 'panel-review';
  if (trimmed.includes('substituted') || trimmed.includes('substitution')) return 'substituted';

  return 'unknown';
}

/**
 * Parse a boolean or string-yes/no to boolean | null.
 */
function parseBoolean(value: boolean | string | null | undefined): boolean | null {
  if (typeof value === 'boolean') return value;
  if (!value) return null;
  const lower = String(value).trim().toLowerCase();
  if (lower === 'true' || lower === 'yes' || lower === 'y' || lower === '1') return true;
  if (lower === 'false' || lower === 'no' || lower === 'n' || lower === '0') return false;
  return null;
}

/* ------------------------------------------------------------------ */
/*  Raw IAAC Record → ImpactAssessmentRecord                           */
/* ------------------------------------------------------------------ */

/**
 * Parse a raw IAAC record into a normalized ImpactAssessmentRecord.
 *
 * @param raw - Raw IAAC record from any source
 * @param options - Parsing options
 * @returns Normalized ImpactAssessmentRecord or null if invalid
 */
export async function parseIaacRecord(
  raw: RawImpactAssessmentRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<ImpactAssessmentRecord | null> {
  const projectName = raw.projectName ?? '';
  if (!projectName) return null;

  const proponent = raw.proponent ?? null;
  const projectType = raw.projectType ?? null;
  const location = raw.location ?? null;
  const province = raw.province ?? null;
  const decision = normalizeDecision(raw.decision);
  const decisionDate = raw.decisionDate ?? null;
  const conditionsUrl = raw.conditionsUrl ?? null;
  const assessmentReportUrl = raw.assessmentReportUrl ?? null;
  const iaacReferenceNumber = raw.iaacReferenceNumber ?? null;
  const ceaaReferenceNumber = raw.ceaaReferenceNumber ?? null;
  const assessmentType = normalizeAssessmentType(raw.assessmentType);
  const federalProvincialAgreement = parseBoolean(raw.federalProvincialAgreement);
  const sourceUrl = raw.sourceUrl ?? '';
  const sourceSystem = options.sourceSystem ?? raw.sourceSystem ?? 'unknown';
  const now = options.ingestedAt ?? new Date().toISOString();

  // Build content hash from normalized fields
  const contentForHash = JSON.stringify({
    projectName,
    proponent,
    projectType,
    location,
    decision,
    decisionDate,
    iaacReferenceNumber,
    assessmentType,
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    projectName,
    proponent,
    projectType,
    location,
    province,
    decision,
    decisionDate,
    conditionsUrl,
    assessmentReportUrl,
    iaacReferenceNumber,
    ceaaReferenceNumber,
    assessmentType,
    federalProvincialAgreement,
    sourceUrl,
    sourceSystem,
    ingestedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/*  Batch Parsing                                                      */
/* ------------------------------------------------------------------ */

/**
 * Parse a batch of raw IAAC records.
 *
 * @param rawRecords - Array of raw IAAC records from any source
 * @param options - Parsing options
 * @returns Array of parsed ImpactAssessmentRecords (invalid records filtered out)
 */
export async function parseIaacBatch(
  rawRecords: RawImpactAssessmentRecord[],
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<ImpactAssessmentRecord[]> {
  const results: ImpactAssessmentRecord[] = [];

  for (const raw of rawRecords) {
    const parsed = await parseIaacRecord(raw, options);
    if (parsed !== null) {
      results.push(parsed);
    }
  }

  return results;
}
