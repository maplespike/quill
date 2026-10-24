// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Alberta Health Parser — Quill
 *
 * Normalizes raw Alberta Health Services records into the unified AHSRecord schema.
 * Each record is assigned a SHA-256 content hash for deduplication.
 */

import { computeHash } from '../../verification/hashing.js';
import { AHS_REGION_MAP } from './constants.js';
import type {
  AHSRecord,
  ABHealthRecord,
  AHSRecordType,
  RawAHSRecord,
  RawABHealthPublication,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Category Normalization                                             */
/* ------------------------------------------------------------------ */

export function normalizeAHSRecordType(
  raw: string | null | undefined,
): AHSRecordType {
  if (!raw) return 'surgery';

  const trimmed = raw.trim().toLowerCase();

  switch (trimmed) {
    case 'surgery':
    case 'surgical':
    case 'surgical wait times':
      return 'surgery';
    case 'emergency':
    case 'emergency department':
    case 'ed':
      return 'emergency';
    case 'diagnostic':
    case 'diagnostic imaging':
    case 'mri':
    case 'ct scan':
      return 'diagnostic';
    case 'inpatient':
    case 'inpatient care':
    case 'hospitalization':
      return 'inpatient';
    default:
      return 'surgery';
  }
}

/* ------------------------------------------------------------------ */
/*  Region Normalization                                               */
/* ------------------------------------------------------------------ */

export function normalizeAHSRegion(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;

  const trimmed = raw.trim().toLowerCase();
  const mapped = AHS_REGION_MAP[trimmed];

  if (mapped) return mapped;

  const keys = Object.keys(AHS_REGION_MAP);
  for (const key of keys) {
    if (trimmed.includes(key)) {
      return AHS_REGION_MAP[key];
    }
  }

  return raw;
}

/* ------------------------------------------------------------------ */
/*  Date Normalization                                                 */
/* ------------------------------------------------------------------ */

function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.substring(0, 10);
  }

  const rfcMatch = trimmed.match(/^\w{3},\s+(\d{1,2})\s+(\w{3})\s+(\d{4})/);
  if (rfcMatch) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const day = rfcMatch[1].padStart(2, '0');
    const month = months[rfcMatch[2].toLowerCase()] ?? '01';
    const year = rfcMatch[3];
    return `${year}-${month}-${day}`;
  }

  const slashMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[3].padStart(2, '0')}`;
  }

  return trimmed.substring(0, 10);
}

/* ------------------------------------------------------------------ */
/*  Raw AHSRecord → AHSRecord                                         */
/* ------------------------------------------------------------------ */

export async function parseAHSRecord(
  raw: RawAHSRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<AHSRecord | null> {
  const measure = raw.measure ?? '';
  if (!measure) return null;

  const category = normalizeAHSRecordType(raw.category);
  const value = raw.value ?? '';
  const region = normalizeAHSRegion(raw.region);
  const fiscalYear = raw.fiscalYear ?? raw.fiscal_year ?? null;
  const quarter = raw.quarter ?? null;
  const sourceUrl = raw.sourceUrl ?? raw.source_url ?? '';
  const sourceSystem = options.sourceSystem ?? raw.sourceSystem ?? 'ab-ahs-surgery';
  const now = options.ingestedAt ?? new Date().toISOString();

  const contentForHash = JSON.stringify({
    category,
    measure,
    value,
    region,
    fiscalYear,
    quarter,
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(`ab-health:${contentForHash}`, 'sha256');

  return {
    id,
    category,
    measure,
    value,
    region,
    fiscalYear,
    quarter,
    sourceUrl,
    sourceSystem,
    ingestedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/*  Raw ABHealthPublication → ABHealthRecord                          */
/* ------------------------------------------------------------------ */

export async function parseABHealthPublication(
  raw: RawABHealthPublication,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<ABHealthRecord | null> {
  const title = raw.title ?? '';
  if (!title) return null;

  const topic = raw.topic ?? 'Health';
  const publicationDate = normalizeDate(raw.publicationDate);
  const dataType = raw.dataType ?? raw.data_type ?? 'report';
  const url = raw.url ?? '';
  const summary = raw.summary ?? raw.description ?? null;
  const sourceSystem = options.sourceSystem ?? raw.sourceSystem ?? 'ab-health';
  const now = options.ingestedAt ?? new Date().toISOString();

  const contentForHash = JSON.stringify({
    title,
    topic,
    publicationDate,
    dataType,
    url,
    summary,
  });

  const id = await computeHash(`ab-health-pub:${contentForHash}`, 'sha256');

  return {
    id,
    title,
    topic,
    publicationDate,
    dataType,
    url,
    summary,
    sourceSystem,
    ingestedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/*  Batch Parsing                                                      */
/* ------------------------------------------------------------------ */

export async function parseAHSBatch(
  rawRecords: RawAHSRecord[],
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<AHSRecord[]> {
  const results: AHSRecord[] = [];

  for (const raw of rawRecords) {
    const parsed = await parseAHSRecord(raw, options);
    if (parsed !== null) {
      results.push(parsed);
    }
  }

  return results;
}

export async function parseABHealthPublicationBatch(
  rawRecords: RawABHealthPublication[],
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<ABHealthRecord[]> {
  const results: ABHealthRecord[] = [];

  for (const raw of rawRecords) {
    const parsed = await parseABHealthPublication(raw, options);
    if (parsed !== null) {
      results.push(parsed);
    }
  }

  return results;
}