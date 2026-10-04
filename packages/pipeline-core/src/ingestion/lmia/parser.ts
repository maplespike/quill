/**
 * LMIA Parser — Quill
 *
 * Parses ESDC quarterly CSV files into structured LmiaRecord objects.
 * Handles the somewhat variable column ordering and naming across
 * different quarterly releases.
 *
 * CSV columns (typical, but varies by quarter):
 *   - Employer / Employer Name / Legal Name
 *   - City / Location - City
 *   - Province / Province / Prov. / Location - Province
 *   - Program / Stream / LMIA Stream / Agricultural Stream
 *   - NOC / NOC Code / NOC 2021 / Occupation Code
 *   - Occupation / Occupation Name / NOC Title
 *   - Positions / Approved Positions / Number of Positions
 *   - Wage / Hourly Wage / Wages / Wage Rate Min / Low Wage
 *   - High Wage / Wage Rate Max / Wage Max
 *   - Wage Rate / Wage Unit / Rate
 */

import { LmiaOutcome, LmiaStream, type LmiaRecord } from './types.js';
import { computeHash } from '../../verification/hashing.js';

import { parseCsvLine } from '../../utils/csv.js';

/**
 * Maps raw stream descriptions from the CSV to canonical LmiaStream values.
 * These are derived from observed ESDC stream labels across quarterly releases.
 */
const STREAM_MAP: Record<string, LmiaStream> = {
  // Agricultural streams
  'agricultural': LmiaStream.Agricultural,
  'agricultural stream': LmiaStream.Agricultural,
  'agriculture': LmiaStream.Agricultural,
  'seasonal agricultural worker program': LmiaStream.Agricultural,
  'sawp': LmiaStream.Agricultural,
  'pcaa': LmiaStream.Agricultural,
  'primary agriculture': LmiaStream.PrimaryAgriculture,
  'primary agriculture stream': LmiaStream.PrimaryAgriculture,

  // Wage streams
  'high wage': LmiaStream.HighWage,
  'high-wage': LmiaStream.HighWage,
  'high wage stream': LmiaStream.HighWage,
  'low wage': LmiaStream.LowWage,
  'low-wage': LmiaStream.LowWage,
  'low wage stream': LmiaStream.LowWage,

  // Global Talent
  'global talent': LmiaStream.GlobalTalent,
  'global talent stream': LmiaStream.GlobalTalent,
  'gts': LmiaStream.GlobalTalent,

  // Permanent Residence
  'permanent residence': LmiaStream.PermanentResidence,
  'permanent residence stream': LmiaStream.PermanentResidence,
  'pr stream': LmiaStream.PermanentResidence,
  'pr': LmiaStream.PermanentResidence,

  // Academic
  'academic': LmiaStream.Academic,
  'academic stream': LmiaStream.Academic,
  'professor': LmiaStream.Academic,
  'faculty': LmiaStream.Academic,

  // In-Home Caregiver
  'in-home caregiver': LmiaStream.InHomeCaregiver,
  'caregiver': LmiaStream.InHomeCaregiver,
  'home child care provider': LmiaStream.InHomeCaregiver,
  'home support worker': LmiaStream.InHomeCaregiver,
  'hccp': LmiaStream.InHomeCaregiver,
  'hsw': LmiaStream.InHomeCaregiver,
};


/**
 * Parse a raw CSV text into an array of LMIA records.
 *
 * The CSV format varies by quarter, so this uses header-based column
 * detection to handle different column orderings and naming conventions.
 *
 * @param csvText - Raw CSV text content
 * @param outcome - Whether this is a positive or negative LMIA dataset
 * @param quarter - Quarter string (e.g. "2025Q4") for metadata
 * @returns Array of parsed LmiaRecord objects
 */
export async function parseLmiaCsv(
  csvText: string,
  outcome: LmiaOutcome,
  quarter: string,
): Promise<LmiaRecord[]> {
  const records: LmiaRecord[] = [];
  const now = new Date().toISOString();

  // Split into lines and remove BOM if present
  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length < 2) return records;

  // Parse header and detect column indices
  const header = parseCsvLine(lines[0]);
  const columns = detectColumns(header);

  if (!columns.employer) {
    // Can't proceed without employer column
    return records;
  }

  // Process data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const row = parseCsvLine(line);
      if (row.length <= columns.employer) continue;

      const record = await parseLmiaRow(row, columns, outcome, quarter, now);
      if (record) {
        records.push(record);
      }
    } catch {
      // Skip malformed rows — non-fatal per row
    }
  }

  return records;
}


interface ColumnIndices {
  employer: number;
  city: number | null;
  province: number | null;
  stream: number | null;
  noc: number | null;
  nocTitle: number | null;
  positions: number | null;
  wageMin: number | null;
  wageMax: number | null;
  wageRate: number | null;
}

/**
 * Detect column indices from CSV header row using fuzzy name matching.
 */
function detectColumns(header: string[]): ColumnIndices {
  const indices: ColumnIndices = {
    employer: -1,
    city: null,
    province: null,
    stream: null,
    noc: null,
    nocTitle: null,
    positions: null,
    wageMin: null,
    wageMax: null,
    wageRate: null,
  };

  const normalizedHeaders = header.map((h) => normalizeHeader(h));

  for (let i = 0; i < normalizedHeaders.length; i++) {
    const h = normalizedHeaders[i];

    // Employer/name columns
    if (isEmployerCol(h)) {
      if (indices.employer < 0) indices.employer = i;
    }

    // Location columns
    if (isCityCol(h)) {
      if (indices.city === null) indices.city = i;
    }
    if (isProvinceCol(h)) {
      if (indices.province === null) indices.province = i;
    }

    // Stream/program columns
    if (isStreamCol(h)) {
      if (indices.stream === null) indices.stream = i;
    }

    // NOC columns
    if (isNocCol(h)) {
      if (indices.noc === null) indices.noc = i;
    }
    if (isNocTitleCol(h)) {
      if (indices.nocTitle === null) indices.nocTitle = i;
    }

    // Position count columns
    if (isPositionsCol(h)) {
      if (indices.positions === null) indices.positions = i;
    }

    // Wage columns
    if (isWageMinCol(h)) {
      if (indices.wageMin === null) indices.wageMin = i;
    }
    if (isWageMaxCol(h)) {
      if (indices.wageMax === null) indices.wageMax = i;
    }
    if (isWageRateCol(h)) {
      if (indices.wageRate === null) indices.wageRate = i;
    }
  }

  return indices;
}


function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[-_./]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isEmployerCol(h: string): boolean {
  return !!h.match(
    /^(employer|legal name|company|organization|business name|nom employeur|nom légal)/,
  );
}

function isCityCol(h: string): boolean {
  return !!h.match(/^(city|location city|municipality|town|ville|localité)/);
}

function isProvinceCol(h: string): boolean {
  return !!h.match(/^(province|prov|prov state|location province|province état|territory)/);
}

function isStreamCol(h: string): boolean {
  return !!h.match(
    /^(stream|program|lmia stream|agricultural stream|program stream|volet|programme)/,
  );
}

function isNocCol(h: string): boolean {
  return !!h.match(
    /^(noc|noc code|noc 2021|noc 2016|occupation code|professional code|codenp|classification)/,
  );
}

function isNocTitleCol(h: string): boolean {
  return !!h.match(
    /^(occupation|occupation name|noc title|job title|position title|profession|emploi|titre)/,
  );
}

function isPositionsCol(h: string): boolean {
  return !!h.match(
    /^(positions|approved positions|number of positions|requested positions|postes|nobre de postes)/,
  );
}

function isWageMinCol(h: string): boolean {
  return !!h.match(
    /^(wage|hourly wage|low wage|wage min|wage rate min|minimum wage|salaire|salaire min)/,
  );
}

function isWageMaxCol(h: string): boolean {
  return !!h.match(
    /^(high wage|wage max|wage rate max|maximum wage|salaire max)/,
  );
}

function isWageRateCol(h: string): boolean {
  return !!h.match(
    /^(wage rate|wage unit|rate|unit|rate type|salaire taux|unité)/,
  );
}


/**
 * Parse a single CSV row into an LmiaRecord.
 */
async function parseLmiaRow(
  row: string[],
  cols: ColumnIndices,
  outcome: LmiaOutcome,
  quarter: string,
  ingestedAt: string,
): Promise<LmiaRecord | null> {
  const employer = safeTrim(row[cols.employer]);
  if (!employer) return null;

  const city = cols.city !== null ? safeTrim(row[cols.city]) : null;
  const province = cols.province !== null ? safeTrim(row[cols.province]) : null;
  const streamRaw = cols.stream !== null ? safeTrim(row[cols.stream]) : '';
  const noc = cols.noc !== null ? safeTrim(row[cols.noc]) : null;
  const nocTitle = cols.nocTitle !== null ? safeTrim(row[cols.nocTitle]) : null;
  const positions = cols.positions !== null ? parseNumber(row[cols.positions]) : null;
  const wageMin = cols.wageMin !== null ? parseNumber(row[cols.wageMin]) : null;
  const wageMax = cols.wageMax !== null ? parseNumber(row[cols.wageMax]) : null;
  const wageRate = cols.wageRate !== null ? safeTrim(row[cols.wageRate]) : null;

  // Extract stream
  const stream = extractStream(streamRaw || '');

  // Build content for hashing (deduplication key)
  const hashContent = [
    employer,
    city,
    province,
    outcome,
    stream,
    noc,
    positions,
    wageMin,
    wageMax,
    quarter,
  ].join('|');

  const id = await computeHash(hashContent, 'sha256');

  return {
    id,
    employer,
    city,
    province: province ? normalizeProvince(province) : null,
    outcome,
    stream,
    streamRaw: streamRaw || '',
    noc: noc || null,
    nocTitle: nocTitle || null,
    positions,
    wageMin,
    wageMax,
    wageRate: wageRate || null,
    quarter,
    ingestedAt,
  };
}


/**
 * Extract the canonical LMIA stream from a raw stream description.
 */
export function extractStream(descriptionText: string): LmiaStream {
  if (!descriptionText) return LmiaStream.Other;

  const normalized = descriptionText.toLowerCase().trim();

  // Try exact match first
  if (STREAM_MAP[normalized]) {
    return STREAM_MAP[normalized];
  }

  // Try partial matching
  for (const [key, stream] of Object.entries(STREAM_MAP)) {
    if (normalized.includes(key)) {
      return stream;
    }
  }

  return LmiaStream.Other;
}


/**
 * Classify occupations based on NOC (National Occupational Classification) code.
 *
 * Returns the NOC broad category (first digit) and skill level.
 *
 * NOC 2021 structure:
 *   - Category 0: Management occupations
 *   - Category 1: Business, finance and administration
 *   - Category 2: Natural and applied sciences
 *   - Category 3: Health
 *   - Category 4: Education, law and social, community and government services
 *   - Category 5: Art, culture, recreation and sport
 *   - Category 6: Sales and service
 *   - Category 7: Trades, transport and equipment operators
 *   - Category 8: Natural resources and agriculture
 *   - Category 9: Manufacturing and utilities
 *
 * @param noc - The NOC code (e.g. "21231", "NOC 21231", "21231 - Software Engineer")
 */
export function classifyOccupation(noc: string | null): {
  broadCategory: string;
  broadCategoryName: string;
  teerLevel: string | null;
} {
  if (!noc) {
    return { broadCategory: 'unknown', broadCategoryName: 'Unknown', teerLevel: null };
  }

  // Extract the first digit of the NOC code
  const match = noc.match(/\b(\d)\d{4}\b/);
  if (!match) {
    return { broadCategory: 'unknown', broadCategoryName: 'Unknown', teerLevel: null };
  }

  const firstDigit = match[1];
  const teerMatch = noc.match(/\b\d{4}(\d)\b/);
  const teerLevel = teerMatch ? teerMatch[1] : null;

  const categoryMap: Record<string, string> = {
    '0': 'Management',
    '1': 'Business, Finance and Administration',
    '2': 'Natural and Applied Sciences',
    '3': 'Health',
    '4': 'Education, Law, Government',
    '5': 'Art, Culture, Recreation',
    '6': 'Sales and Service',
    '7': 'Trades, Transport and Equipment',
    '8': 'Natural Resources and Agriculture',
    '9': 'Manufacturing and Utilities',
  };

  return {
    broadCategory: firstDigit,
    broadCategoryName: categoryMap[firstDigit] || 'Unknown',
    teerLevel,
  };
}




function safeTrim(val: string | undefined): string {
  return (val || '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
}

function parseNumber(val: string | undefined): number | null {
  if (!val) return null;
  const cleaned = val.replace(/[$,€£\s]/g, '').replace(/^["']|["']$/g, '');
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Normalize province/territory names/abbreviations to 2-letter codes.
 */
function normalizeProvince(input: string): string {
  const normalized = input.trim().toUpperCase();

  // Already a 2-letter code
  if (/^[A-Z]{2}$/.test(normalized)) {
    return normalized;
  }

  const provinceMap: Record<string, string> = {
    'ONTARIO': 'ON',
    'ONT.': 'ON',
    'QUEBEC': 'QC',
    'QUÉBEC': 'QC',
    'QUE.': 'QC',
    'QUÉ.': 'QC',
    'PQ': 'QC',
    'BRITISH COLUMBIA': 'BC',
    'B.C.': 'BC',
    'BC': 'BC',
    'ALBERTA': 'AB',
    'ALTA.': 'AB',
    'AB': 'AB',
    'SASKATCHEWAN': 'SK',
    'SASK.': 'SK',
    'SK': 'SK',
    'MANITOBA': 'MB',
    'MAN.': 'MB',
    'MB': 'MB',
    'NOVA SCOTIA': 'NS',
    'N.S.': 'NS',
    'NS': 'NS',
    'NEW BRUNSWICK': 'NB',
    'N.B.': 'NB',
    'NB': 'NB',
    'NEWFOUNDLAND AND LABRADOR': 'NL',
    'NEWFOUNDLAND': 'NL',
    'NFLD.': 'NL',
    'N.L.': 'NL',
    'NL': 'NL',
    'PRINCE EDWARD ISLAND': 'PE',
    'P.E.I.': 'PE',
    'PEI': 'PE',
    'PE': 'PE',
    'YUKON': 'YT',
    'YUKON TERRITORY': 'YT',
    'YT': 'YT',
    'NORTHWEST TERRITORIES': 'NT',
    'N.W.T.': 'NT',
    'NT': 'NT',
    'NUNAVUT': 'NU',
    'NU': 'NU',
  };

  return provinceMap[normalized] || input;
}
