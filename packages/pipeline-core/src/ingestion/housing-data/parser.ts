// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Housing Data Parser — Quill
 *
 * Normalizes raw CMHC housing market and CHSP records into the unified schema.
 * Each record is assigned a SHA-256 content hash for deduplication.
 */

import { computeHash } from '../../verification/hashing.js';
import { METRO_AREA_MAP, HOUSING_TYPE_MAP } from './constants.js';
import type {
  HousingMarketRecord,
  HousingStartRecord,
  HousingCompletionRecord,
  HousingCategory,
  RawHousingMarketRecord,
  RawHousingStartRecord,
  RawHousingCompletionRecord,
} from './types.js';

function normalizeMetroArea(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim().toLowerCase();
  const mapped = METRO_AREA_MAP[trimmed];

  if (mapped) return mapped;

  const keys = Object.keys(METRO_AREA_MAP);
  for (const key of keys) {
    if (trimmed.includes(key)) {
      return METRO_AREA_MAP[key];
    }
  }

  return raw;
}

function normalizeHousingType(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim().toLowerCase();
  const mapped = HOUSING_TYPE_MAP[trimmed];

  if (mapped) return mapped;

  const keys = Object.keys(HOUSING_TYPE_MAP);
  for (const key of keys) {
    if (trimmed.includes(key)) {
      return HOUSING_TYPE_MAP[key];
    }
  }

  return raw;
}

function normalizeCategory(raw: string | null | undefined): HousingCategory {
  if (!raw) return 'rental';

  const trimmed = raw.trim().toLowerCase();

  switch (trimmed) {
    case 'rental':
    case 'rent':
      return 'rental';
    case 'ownership':
    case 'owner':
    case 'home':
      return 'ownership';
    case 'vacancy':
    case 'vacancy rate':
      return 'vacancy';
    case 'starts':
    case 'housing starts':
    case 'construction starts':
      return 'starts';
    case 'completions':
    case 'housing completions':
      return 'completions';
    case 'under construction':
    case 'under-construction':
    case 'in progress':
      return 'under-construction';
    case 'affordability':
    case 'affordable':
    case 'price index':
      return 'affordability';
    default:
      return 'rental';
  }
}

function normalizePeriod(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();

  if (/^\d{4}-Q[1-4]$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{4}Q[1-4]$/.test(trimmed)) {
    return trimmed.replace(/(\d{4})Q([1-4])/, '$1-Q$2');
  }

  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{4}\/\d{2}$/.test(trimmed)) {
    return trimmed.replace('/', '-');
  }

  return trimmed.substring(0, 10);
}

export async function parseHousingMarketRecord(
  raw: RawHousingMarketRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<HousingMarketRecord | null> {
  const metroArea = raw.metroArea ?? raw.metro_area ?? raw.city ?? null;
  if (!metroArea) return null;

  const category = normalizeCategory(raw.category);
  const housingType = normalizeHousingType(raw.housingType ?? raw.housing_type ?? raw.type);
  const averagePrice = raw.averagePrice ?? raw.average_price ?? raw.avgPrice ?? raw.avg_price ?? null;
  const medianPrice = raw.medianPrice ?? raw.median_price ?? null;
  const rentalRate = raw.rentalRate ?? raw.rental_rate ?? null;
  const vacancyRate = raw.vacancyRate ?? raw.vacancy_rate ?? null;
  const period = normalizePeriod(raw.period ?? raw.quarter);
  const sourceUrl = raw.sourceUrl ?? raw.source_url ?? raw.url ?? '';
  const sourceSystem = options.sourceSystem ?? raw.sourceSystem ?? raw.source_system ?? 'cmhc-housing';
  const now = options.ingestedAt ?? new Date().toISOString();

  const normalizedMetroArea = normalizeMetroArea(metroArea);

  const contentForHash = JSON.stringify({
    category,
    metroArea: normalizedMetroArea,
    housingType,
    averagePrice,
    medianPrice,
    rentalRate,
    vacancyRate,
    period,
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(`housing-market:${contentForHash}`, 'sha256');

  return {
    id,
    category,
    metroArea: normalizedMetroArea,
    housingType,
    averagePrice,
    medianPrice,
    rentalRate,
    vacancyRate,
    period,
    sourceUrl,
    sourceSystem,
    ingestedAt: now,
  };
}

export async function parseHousingStartRecord(
  raw: RawHousingStartRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<HousingStartRecord | null> {
  const province = raw.province ?? null;
  if (!province) return null;

  const metroArea = normalizeMetroArea(raw.metroArea ?? raw.metro_area ?? raw.city ?? null);
  const housingType = normalizeHousingType(raw.housingType ?? raw.housing_type ?? raw.type);
  const housingStarts = raw.housingStarts ?? raw.housing_starts ?? raw.starts ?? null;
  const period = normalizePeriod(raw.period ?? raw.quarter);
  const sourceUrl = raw.sourceUrl ?? raw.source_url ?? raw.url ?? '';
  const sourceSystem = options.sourceSystem ?? raw.sourceSystem ?? raw.source_system ?? 'chsp-starts';
  const now = options.ingestedAt ?? new Date().toISOString();

  const contentForHash = JSON.stringify({
    province,
    metroArea,
    housingType,
    housingStarts,
    period,
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(`housing-start:${contentForHash}`, 'sha256');

  return {
    id,
    province,
    metroArea,
    housingType,
    housingStarts,
    period,
    sourceUrl,
    sourceSystem,
    ingestedAt: now,
  };
}

export async function parseHousingCompletionRecord(
  raw: RawHousingCompletionRecord,
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<HousingCompletionRecord | null> {
  const province = raw.province ?? null;
  if (!province) return null;

  const metroArea = normalizeMetroArea(raw.metroArea ?? raw.metro_area ?? raw.city ?? null);
  const housingType = normalizeHousingType(raw.housingType ?? raw.housing_type ?? raw.type);
  const completions = raw.completions ?? null;
  const underConstruction = raw.underConstruction ?? raw.under_construction ?? null;
  const period = normalizePeriod(raw.period ?? raw.quarter);
  const sourceUrl = raw.sourceUrl ?? raw.source_url ?? raw.url ?? '';
  const sourceSystem = options.sourceSystem ?? raw.sourceSystem ?? raw.source_system ?? 'chsp-completions';
  const now = options.ingestedAt ?? new Date().toISOString();

  const contentForHash = JSON.stringify({
    province,
    metroArea,
    housingType,
    completions,
    underConstruction,
    period,
    sourceUrl,
    sourceSystem,
  });

  const id = await computeHash(`housing-completion:${contentForHash}`, 'sha256');

  return {
    id,
    province,
    metroArea,
    housingType,
    completions,
    underConstruction,
    period,
    sourceUrl,
    sourceSystem,
    ingestedAt: now,
  };
}

export async function parseHousingDataRecords(
  rawRecords: (RawHousingMarketRecord | RawHousingStartRecord | RawHousingCompletionRecord)[],
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<(HousingMarketRecord | HousingStartRecord | HousingCompletionRecord)[]> {
  const results: (HousingMarketRecord | HousingStartRecord | HousingCompletionRecord)[] = [];
  const seenHashes = new Set<string>();

  for (const raw of rawRecords) {
    try {
      let parsed: HousingMarketRecord | HousingStartRecord | HousingCompletionRecord | null = null;

      if ('averagePrice' in raw || 'medianPrice' in raw || 'rentalRate' in raw || 'vacancyRate' in raw) {
        parsed = await parseHousingMarketRecord(raw as RawHousingMarketRecord, options);
      } else if ('housingStarts' in raw || 'starts' in raw) {
        parsed = await parseHousingStartRecord(raw as RawHousingStartRecord, options);
      } else if ('completions' in raw || 'underConstruction' in raw) {
        parsed = await parseHousingCompletionRecord(raw as RawHousingCompletionRecord, options);
      }

      if (parsed !== null) {
        if (!seenHashes.has(parsed.id)) {
          seenHashes.add(parsed.id);
          results.push(parsed);
        }
      }
    } catch (err) {
      console.warn(`Failed to parse housing record: ${(err as Error).message}`);
    }
  }

  return results;
}

export async function parseHousingMarketBatch(
  rawRecords: RawHousingMarketRecord[],
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<HousingMarketRecord[]> {
  const results: HousingMarketRecord[] = [];

  for (const raw of rawRecords) {
    const parsed = await parseHousingMarketRecord(raw, options);
    if (parsed !== null) {
      results.push(parsed);
    }
  }

  return results;
}

export async function parseHousingStartBatch(
  rawRecords: RawHousingStartRecord[],
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<HousingStartRecord[]> {
  const results: HousingStartRecord[] = [];

  for (const raw of rawRecords) {
    const parsed = await parseHousingStartRecord(raw, options);
    if (parsed !== null) {
      results.push(parsed);
    }
  }

  return results;
}

export async function parseHousingCompletionBatch(
  rawRecords: RawHousingCompletionRecord[],
  options: {
    sourceSystem?: string;
    ingestedAt?: string;
  } = {},
): Promise<HousingCompletionRecord[]> {
  const results: HousingCompletionRecord[] = [];

  for (const raw of rawRecords) {
    const parsed = await parseHousingCompletionRecord(raw, options);
    if (parsed !== null) {
      results.push(parsed);
    }
  }

  return results;
}