/**
 * Real Estate Parser — Quill
 *
 * Parses CSV files for Canadian real estate data into structured records:
 *   - RentalMarketData: CMHC Rental Market Survey (vacancy rates, average rents by unit type)
 *   - HousingStart: CMHC Housing Starts data by province, centre, and dwelling type
 *   - HousePriceIndex: MLS Home Price Index and New Housing Price Index
 *   - PropertyAssessment: Provincial property assessment roll data
 *
 * Follows canonical pattern: async parseX(), computeHash IDs, seenHashes dedup, try-catch per record.
 */

import { computeHash } from '../../verification/hashing.js';
import { parseCsvLine, parseCurrency, normalizeHeader } from '../../utils/csv.js';
import type {
  RentalMarketData,
  HousingStart,
  HousePriceIndex,
  PropertyAssessment,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Normalization Constants                                             */
/* ------------------------------------------------------------------ */

const PROVINCE_CODE_MAP: Record<string, string> = {
  'alberta': 'AB',
  'british columbia': 'BC',
  'bc': 'BC',
  'manitoba': 'MB',
  'new brunswick': 'NB',
  'newfoundland': 'NL',
  'newfoundland and labrador': 'NL',
  'nova scotia': 'NS',
  'ontario': 'ON',
  'prince edward island': 'PE',
  'pei': 'PE',
  'quebec': 'QC',
  'saskatchewan': 'SK',
  'northwest territories': 'NT',
  'nunavut': 'NU',
  'yukon': 'YT',
};

const METRO_NORMALIZATION: Record<string, string> = {
  'toronto': 'Toronto',
  'vancouver': 'Vancouver',
  'montreal': 'Montreal',
  'calgary': 'Calgary',
  'edmonton': 'Edmonton',
  'ottawa': 'Ottawa',
  'ottawa-gatineau': 'Ottawa',
  'winnipeg': 'Winnipeg',
  'halifax': 'Halifax',
  'quebec city': 'Quebec City',
  'hamilton': 'Hamilton',
  'kitchener-waterloo': 'Kitchener-Waterloo',
  'london': 'London',
  'victoria': 'Victoria',
  'saskatoon': 'Saskatoon',
  'regina': 'Regina',
  'st. john\'s': 'St. John\'s',
  'saint john': 'Saint John',
};

const DWELLING_TYPE_MAP: Record<string, string> = {
  'single': 'Single-detached',
  'single-detached': 'Single-detached',
  'single detached': 'Single-detached',
  'semi': 'Semi-detached',
  'semi-detached': 'Semi-detached',
  'semi detached': 'Semi-detached',
  'row': 'Row',
  'row house': 'Row',
  'townhouse': 'Row',
  'apartment': 'Apartment',
  'apartment unit': 'Apartment',
  'condo': 'Apartment',
  'condominium': 'Apartment',
};

const UNIT_TYPE_MAP: Record<string, string> = {
  'bachelor': 'Bachelor',
  'studio': 'Bachelor',
  '1br': '1BR',
  '1 bedroom': '1BR',
  'one bedroom': '1BR',
  '2br': '2BR',
  '2 bedroom': '2BR',
  'two bedroom': '2BR',
  '3br': '3BR',
  '3 bedroom': '3BR',
  'three bedroom': '3BR',
};

/* ------------------------------------------------------------------ */
/*  Parser Options                                                      */
/* ------------------------------------------------------------------ */

export interface ParserOptions {
  sourceUrl: string;
  datasetYear?: string;
  skipDuplicates?: boolean;
}

export interface ParseResult<T> {
  records: T[];
  errors: string[];
  duplicateCount: number;
}

/* ------------------------------------------------------------------ */
/*  CSV Parsing Helpers                                                 */
/* ------------------------------------------------------------------ */

function safeTrim(val: string | undefined): string {
  if (!val) return '';
  return val.replace(/^["'\s]+|["'\s]+$/g, '').trim();
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  const normalizedHeaders = headers.map(h => normalizeHeader(h));

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeHeader(candidate);
    const idx = normalizedHeaders.indexOf(normalizedCandidate);
    if (idx >= 0) return idx;

    // Try contains match
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (normalizedHeaders[i].includes(normalizedCandidate) || normalizedCandidate.includes(normalizedHeaders[i])) {
        return i;
      }
    }
  }
  return -1;
}

function normalizeProvinceCode(val: string | undefined): string {
  if (!val) return '';
  const normalized = val.toLowerCase().trim();
  return PROVINCE_CODE_MAP[normalized] || val.toUpperCase().substring(0, 2);
}

function normalizeMetroName(val: string | undefined): string {
  if (!val) return '';
  const normalized = val.toLowerCase().trim();
  return METRO_NORMALIZATION[normalized] || val.trim();
}

function normalizeDwellingType(val: string | undefined): string {
  if (!val) return '';
  const normalized = val.toLowerCase().trim();
  return DWELLING_TYPE_MAP[normalized] || val.trim();
}

function normalizeUnitType(val: string | undefined): string {
  if (!val) return '';
  const normalized = val.toLowerCase().trim();
  return UNIT_TYPE_MAP[normalized] || val.trim();
}

/* ------------------------------------------------------------------ */
/*  Rental Market Data Parser                                           */
/* ------------------------------------------------------------------ */

export async function parseRentalMarketData(
  csvText: string,
  options: ParserOptions,
): Promise<ParseResult<RentalMarketData>> {
  const records: RentalMarketData[] = [];
  const errors: string[] = [];
  const seenHashes = new Set<string>();
  let duplicateCount = 0;

  if (!csvText || csvText.trim().length === 0) {
    return { records, errors, duplicateCount };
  }

  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length < 2) {
    return { records, errors, duplicateCount };
  }

  const header = parseCsvLine(lines[0]);

  // Detect column indices
  const metroIdx = findColumnIndex(header, ['metro', 'metro area', 'city', 'cma', 'census metropolitan area']);
  const provinceIdx = findColumnIndex(header, ['province', 'prov', 'province_code']);
  const vacancyIdx = findColumnIndex(header, ['vacancy rate', 'vacancy_rate', 'vacancy%']);
  const rentIdx = findColumnIndex(header, ['average rent', 'average_rent', 'avg rent', 'rent']);
  const unitTypeIdx = findColumnIndex(header, ['unit type', 'unit_type', 'unit type', 'bedrooms']);
  const quarterIdx = findColumnIndex(header, ['quarter', 'q', 'period']);
  const yearIdx = findColumnIndex(header, ['year']);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const fields = parseCsvLine(line);

      const metro = normalizeMetroName(safeTrim(fields[metroIdx]));
      const province = normalizeProvinceCode(safeTrim(fields[provinceIdx]));
      const vacancyRate = parseCurrency(safeTrim(fields[vacancyIdx]));
      const averageRent = parseCurrency(safeTrim(fields[rentIdx]));
      const unitType = normalizeUnitType(safeTrim(fields[unitTypeIdx]));
      const quarter = safeTrim(fields[quarterIdx]);
      const year = safeTrim(fields[yearIdx]) || options.datasetYear || new Date().getFullYear().toString();

      if (!metro || !province) continue;

      // Compute hash ID
      const idContent = `${metro}|${province}|${unitType}|${quarter}|${year}`;
      const id = await computeHash(idContent, 'sha256');

      // Deduplicate
      if (options.skipDuplicates && seenHashes.has(id)) {
        duplicateCount++;
        continue;
      }
      seenHashes.add(id);

      records.push({
        id,
        municipality: metro,
        province,
        vacancyRate: vacancyRate ?? 0,
        averageRent: averageRent ?? 0,
        unitType: unitType || 'Unknown',
        year: parseInt(year, 10),
        source: options.sourceUrl,
        url: options.sourceUrl,
      });
    } catch (err) {
      errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { records, errors, duplicateCount };
}

/* ------------------------------------------------------------------ */
/*  Housing Starts Parser                                               */
/* ------------------------------------------------------------------ */

export async function parseHousingStarts(
  csvText: string,
  options: ParserOptions,
): Promise<ParseResult<HousingStart>> {
  const records: HousingStart[] = [];
  const errors: string[] = [];
  const seenHashes = new Set<string>();
  let duplicateCount = 0;

  if (!csvText || csvText.trim().length === 0) {
    return { records, errors, duplicateCount };
  }

  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length < 2) {
    return { records, errors, duplicateCount };
  }

  const header = parseCsvLine(lines[0]);

  // Detect column indices
  const provinceIdx = findColumnIndex(header, ['province', 'prov', 'province_code']);
  const centreIdx = findColumnIndex(header, ['centre', 'city', 'municipality', 'metro', 'cma']);
  const startsIdx = findColumnIndex(header, ['starts', 'housing starts', 'housing_starts', 'start count']);
  const periodIdx = findColumnIndex(header, ['period', 'month', 'date', 'quarter']);
  const dwellingTypeIdx = findColumnIndex(header, ['dwelling type', 'dwelling_type', 'type', 'housing type']);
  const yearIdx = findColumnIndex(header, ['year']);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const fields = parseCsvLine(line);

      const province = normalizeProvinceCode(safeTrim(fields[provinceIdx]));
      const centre = normalizeMetroName(safeTrim(fields[centreIdx]));
      const starts = parseCurrency(safeTrim(fields[startsIdx]));
      const period = safeTrim(fields[periodIdx]);
      const dwellingType = normalizeDwellingType(safeTrim(fields[dwellingTypeIdx]));
      const year = safeTrim(fields[yearIdx]) || options.datasetYear || new Date().getFullYear().toString();

      if (!centre || !province) continue;

      // Compute hash ID
      const idContent = `${centre}|${province}|${dwellingType}|${period}|${year}`;
      const id = await computeHash(idContent, 'sha256');

      // Deduplicate
      if (options.skipDuplicates && seenHashes.has(id)) {
        duplicateCount++;
        continue;
      }
      seenHashes.add(id);

      // Parse month from period if possible
      let month: number | undefined;
      const monthMatch = period.match(/(\d{4})-(\d{2})/);
      if (monthMatch) {
        month = parseInt(monthMatch[2], 10);
      }

      records.push({
        id,
        municipality: centre,
        province,
        starts: starts ?? 0,
        year: parseInt(year, 10),
        month,
        housingType: dwellingType || 'Unknown',
        source: options.sourceUrl,
        url: options.sourceUrl,
      });
    } catch (err) {
      errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { records, errors, duplicateCount };
}

/* ------------------------------------------------------------------ */
/*  House Price Index Parser                                            */
/* ------------------------------------------------------------------ */

export async function parseHousePriceIndex(
  csvText: string,
  options: ParserOptions,
): Promise<ParseResult<HousePriceIndex>> {
  const records: HousePriceIndex[] = [];
  const errors: string[] = [];
  const seenHashes = new Set<string>();
  let duplicateCount = 0;

  if (!csvText || csvText.trim().length === 0) {
    return { records, errors, duplicateCount };
  }

  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length < 2) {
    return { records, errors, duplicateCount };
  }

  const header = parseCsvLine(lines[0]);

  // Detect column indices
  const metroIdx = findColumnIndex(header, ['metro', 'metro area', 'city', 'cma', 'census metropolitan area']);
  const provinceIdx = findColumnIndex(header, ['province', 'prov', 'province_code']);
  const indexValueIdx = findColumnIndex(header, ['index value', 'index_value', 'index', 'hpi']);
  const changePercentIdx = findColumnIndex(header, ['% change yoy', 'change_percent', 'yoy change', 'annual change']);
  const periodIdx = findColumnIndex(header, ['period', 'month', 'date', 'quarter', 'year']);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const fields = parseCsvLine(line);

      const metro = normalizeMetroName(safeTrim(fields[metroIdx]));
      const province = normalizeProvinceCode(safeTrim(fields[provinceIdx]));
      const indexValue = parseCurrency(safeTrim(fields[indexValueIdx]));
      const changePercent = parseCurrency(safeTrim(fields[changePercentIdx]));
      const period = safeTrim(fields[periodIdx]);

      if (!metro) continue;

      // Compute hash ID
      const idContent = `${metro}|${province || ''}|${period}`;
      const id = await computeHash(idContent, 'sha256');

      // Deduplicate
      if (options.skipDuplicates && seenHashes.has(id)) {
        duplicateCount++;
        continue;
      }
      seenHashes.add(id);

      records.push({
        id,
        city: metro,
        province: province || '',
        indexValue: indexValue ?? 0,
        changePercent: changePercent ?? 0,
        period: period || '',
        source: options.sourceUrl,
        url: options.sourceUrl,
      });
    } catch (err) {
      errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { records, errors, duplicateCount };
}

/* ------------------------------------------------------------------ */
/*  Property Assessment Parser                                          */
/* ------------------------------------------------------------------ */

export async function parsePropertyAssessment(
  csvText: string,
  options: ParserOptions,
): Promise<ParseResult<PropertyAssessment>> {
  const records: PropertyAssessment[] = [];
  const errors: string[] = [];
  const seenHashes = new Set<string>();
  let duplicateCount = 0;

  if (!csvText || csvText.trim().length === 0) {
    return { records, errors, duplicateCount };
  }

  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length < 2) {
    return { records, errors, duplicateCount };
  }

  const header = parseCsvLine(lines[0]);

  // Detect column indices
  const municipalityIdx = findColumnIndex(header, ['municipality', 'city', 'jurisdiction']);
  const provinceIdx = findColumnIndex(header, ['province', 'prov', 'province_code']);
  const assessedValueIdx = findColumnIndex(header, ['total assessed value', 'total_assessed_value', 'assessed value', 'assessment value']);
  const yearIdx = findColumnIndex(header, ['year', 'assessment year', 'tax year']);
  const parcelIdIdx = findColumnIndex(header, ['parcel id', 'parcel_id', 'roll number', 'pid']);
  const propertyTypeIdx = findColumnIndex(header, ['property type', 'property_type', 'type']);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const fields = parseCsvLine(line);

      const municipality = safeTrim(fields[municipalityIdx]);
      const province = normalizeProvinceCode(safeTrim(fields[provinceIdx]));
      const assessedValue = parseCurrency(safeTrim(fields[assessedValueIdx]));
      const year = safeTrim(fields[yearIdx]) || options.datasetYear || new Date().getFullYear().toString();
      const parcelId = safeTrim(fields[parcelIdIdx]);
      const propertyType = safeTrim(fields[propertyTypeIdx]);

      if (!municipality) continue;

      // Compute hash ID
      const idContent = `${municipality}|${province || ''}|${year}|${parcelId || ''}`;
      const id = await computeHash(idContent, 'sha256');

      // Deduplicate
      if (options.skipDuplicates && seenHashes.has(id)) {
        duplicateCount++;
        continue;
      }
      seenHashes.add(id);

      records.push({
        id,
        jurisdiction: municipality,
        province: province || '',
        assessedValue: assessedValue ?? 0,
        year: parseInt(year, 10),
        propertyType: propertyType || 'Unknown',
        municipality,
        parcelId: parcelId || undefined,
        url: options.sourceUrl,
      });
    } catch (err) {
      errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { records, errors, duplicateCount };
}

/* ------------------------------------------------------------------ */
/*  Batch Parser                                                        */
/* ------------------------------------------------------------------ */

export interface RawCsvData {
  rentalMarketData?: string;
  housingStarts?: string;
  housePriceIndex?: string;
  propertyAssessment?: string;
}

export interface ParseAllRealEstateResult {
  rentalMarketData: ParseResult<RentalMarketData>;
  housingStarts: ParseResult<HousingStart>;
  housePriceIndex: ParseResult<HousePriceIndex>;
  propertyAssessment: ParseResult<PropertyAssessment>;
  totalRecords: number;
  totalErrors: number;
  totalDuplicates: number;
}

/**
 * Parse all real estate CSV records into structured data.
 *
 * This function batch processes multiple CSV file types:
 *   - Rental Market Data
 *   - Housing Starts
 *   - House Price Index
 *   - Property Assessment
 *
 * All parsers follow the same pattern:
 *   - Compute SHA-256 hash IDs for deduplication
 *   - Use seenHashes for optional deduplication
 *   - Try-catch per record for resilience
 *   - Return ParseResult with records, errors, and duplicate count
 *
 * @param rawRecords - Object containing raw CSV text for each data type
 * @param options - Parser options including sourceUrl and optional datasetYear
 * @returns ParseAllRealEstateResult with all parsed data and aggregate statistics
 */
export async function parseAllRealEstateRecords(
  rawRecords: RawCsvData,
  options: ParserOptions,
): Promise<ParseAllRealEstateResult> {
  const defaultOptions = { ...options, skipDuplicates: options.skipDuplicates ?? true };

  const [
    rentalMarketData,
    housingStarts,
    housePriceIndex,
    propertyAssessment,
  ] = await Promise.all([
    parseRentalMarketData(rawRecords.rentalMarketData || '', defaultOptions),
    parseHousingStarts(rawRecords.housingStarts || '', defaultOptions),
    parseHousePriceIndex(rawRecords.housePriceIndex || '', defaultOptions),
    parsePropertyAssessment(rawRecords.propertyAssessment || '', defaultOptions),
  ]);

  const totalRecords =
    rentalMarketData.records.length +
    housingStarts.records.length +
    housePriceIndex.records.length +
    propertyAssessment.records.length;

  const totalErrors =
    rentalMarketData.errors.length +
    housingStarts.errors.length +
    housePriceIndex.errors.length +
    propertyAssessment.errors.length;

  const totalDuplicates =
    rentalMarketData.duplicateCount +
    housingStarts.duplicateCount +
    housePriceIndex.duplicateCount +
    propertyAssessment.duplicateCount;

  return {
    rentalMarketData,
    housingStarts,
    housePriceIndex,
    propertyAssessment,
    totalRecords,
    totalErrors,
    totalDuplicates,
  };
}