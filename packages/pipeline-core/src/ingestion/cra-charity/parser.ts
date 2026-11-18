// SPDX-License-Identifier: AGPL-3.0-only
/**
 * CRA Charity T3010 Parser — Quill
 *
 * Parses CRA List of Charities CSV files into structured CraCharityT3010
 * records. Joins data from multiple CSV files (identification, financial,
 * general info, charitable programs) by BN.
 *
 * The CSV format changes year-to-year, so this uses header-based column
 * detection with fuzzy name matching (same pattern as the LMIA parser).
 *
 * CSV Resources per year:
 *   - Identification:  BN, legal name, operating name, status, category, designation
 *   - Financial data:  Revenue, expenses, assets, liabilities, political activities
 *   - General info:    Fiscal year dates, compensation
 *   - Programs:        Charitable program descriptions
 */

import { computeHash } from '../../verification/hashing.js';
import {
  CharityCategory,
  CharityDesignation,
  CharityStatus,
  type CraCharityT3010,
} from './types.js';
import {
  IDENT_COLUMN_ALIASES,
  FINANCIAL_COLUMN_ALIASES,
  GENERAL_COLUMN_ALIASES,
  CRA_STATUS_MAP,
} from './constants.js';

import { parseCsvLine } from '../../utils/csv.js';

/* ------------------------------------------------------------------ */
/*  Main Parse Entry Points                                            */
/* ------------------------------------------------------------------ */

export interface CraCsvData {
  identCsv: string;
  financialCsv: string;
  generalCsv: string;
  programsCsv: string;
}

/**
 * Parse all CRA CSV data for a given year into an array of CraCharityT3010 records.
 *
 * This function:
 *   1. Parses each CSV independently into raw row maps
 *   2. Indexes rows by BN
 *   3. Joins identification + financial + general + programs data
 *   4. Returns structured CraCharityT3010 records
 *
 * @param csvData - Object containing the raw CSV text for each resource
 * @param year - Dataset year (e.g. "2024")
 * @param sourceUrl - CKAN dataset source URL
 * @returns Array of merged CraCharityT3010 records
 */
export async function parseCraCsvs(
  csvData: CraCsvData,
  year: string,
  sourceUrl: string,
): Promise<CraCharityT3010[]> {
  const now = new Date().toISOString();

  // Phase 1: Parse each CSV
  const identRows = parseCsvToRows(csvData.identCsv, IDENT_COLUMN_ALIASES);
  const financialRows = parseCsvToRows(csvData.financialCsv, FINANCIAL_COLUMN_ALIASES);
  const generalRows = parseCsvToRows(csvData.generalCsv, GENERAL_COLUMN_ALIASES);
  const programsRows = parseProgramsCsv(csvData.programsCsv);

  // Phase 2: Index by BN
  const identByBn = indexByBn(identRows);
  const financialByBn = indexByBn(financialRows);
  const generalByBn = indexByBn(generalRows);
  const programsByBn = programsRows;

  // Phase 3: Join on BN — iterate ident rows as the primary source
  const records: CraCharityT3010[] = [];
  const seenBns = new Set<string>();

  for (const identRow of identRows) {
    const bn = identRow['bn'] || '';
    if (!bn || seenBns.has(bn)) continue;
    seenBns.add(bn);

    try {
      const record = await joinRecord(
        bn,
        identRow,
        financialByBn.get(bn),
        generalByBn.get(bn),
        programsByBn.get(bn) || [],
        year,
        sourceUrl,
        now,
      );
      if (record) {
        records.push(record);
      }
    } catch {
      // Skip malformed rows — non-fatal per row
    }
  }

  return records;
}


/**
 * Parse a single identification CSV into CraCharityT3010 records
 * without financial data (useful for keyword search results from CRA website).
 */
export async function parseCraIdentCsv(
  csvText: string,
  year: string,
  sourceUrl: string,
): Promise<CraCharityT3010[]> {
  const now = new Date().toISOString();
  const rows = parseCsvToRows(csvText, IDENT_COLUMN_ALIASES);
  const records: CraCharityT3010[] = [];

  for (const row of rows) {
    const bn = row['bn'] || '';
    if (!bn) continue;

    try {
      const id = await computeHash(`${bn}|${year}`, 'sha256');
      records.push({
        id,
        bn,
        legalName: row['legal_name'] || '',
        operatingName: row['operating_name'] || null,
        category: parseCategory(row['category']),
        designation: CharityDesignation.Unknown,
        status: parseStatus(row['status']),
        fiscalYearStart: null,
        fiscalYearEnd: null,
        totalRevenue: null,
        totalExpenses: null,
        totalAssets: null,
        totalLiabilities: null,
        compensationKeyEmployees: null,
        charitableProgramsDescription: null,
        politicalActivitiesAmount: null,
        grantsAmount: null,
        datasetYear: year,
        sourceUrl,
        ingestedAt: now,
      });
    } catch {
      // Skip malformed rows
    }
  }

  return records;
}


/* ------------------------------------------------------------------ */
/*  Row Joiner                                                         */
/* ------------------------------------------------------------------ */

async function joinRecord(
  bn: string,
  ident: Record<string, string>,
  financial: Record<string, string> | undefined,
  general: Record<string, string> | undefined,
  programs: ProgramDescription[],
  year: string,
  sourceUrl: string,
  now: string,
): Promise<CraCharityT3010 | null> {
  const legalName = ident['legal_name'] || '';
  if (!legalName) return null;

  const idContent = `${bn}|${financial?.['fiscal_year_end'] || general?.['fiscal_year_end'] || year}`;
  const id = await computeHash(idContent, 'sha256');

  // Parse financial fields
  const totalRevenue = parseCurrency(financial?.['total_revenue']);
  const totalExpenses = parseCurrency(financial?.['total_expenses']);
  const totalAssets = parseCurrency(financial?.['total_assets']);
  const totalLiabilities = parseCurrency(financial?.['total_liabilities']);
  const politicalActivitiesAmount = parseCurrency(financial?.['political_activities_amount']);
  const grantsAmount = parseCurrency(financial?.['grants_amount']);

  // Fiscal year dates — prefer general CSV, fall back to financial
  const fiscalYearStart = general?.['fiscal_year_start'] || financial?.['fiscal_year_start'] || null;
  const fiscalYearEnd = general?.['fiscal_year_end'] || financial?.['fiscal_year_end'] || null;

  // Compensation — from general info CSV
  const compensationKeyEmployees = parseCurrency(general?.['compensation_key_employees']);

  // Charitable programs description — join multiple program descriptions
  const charitableProgramsDescription = joinProgramDescriptions(programs);

  return {
    id,
    bn,
    legalName,
    operatingName: ident['operating_name'] || null,
    category: parseCategory(ident['category']),
    designation: CharityDesignation.Unknown,
    status: parseStatus(ident['status']),
    fiscalYearStart: fiscalYearStart || null,
    fiscalYearEnd: fiscalYearEnd || null,
    totalRevenue,
    totalExpenses,
    totalAssets,
    totalLiabilities,
    compensationKeyEmployees,
    charitableProgramsDescription,
    politicalActivitiesAmount,
    grantsAmount,
    datasetYear: year,
    sourceUrl,
    ingestedAt: now,
  };
}


/* ------------------------------------------------------------------ */
/*  CSV Parsing Helpers                                                */
/* ------------------------------------------------------------------ */

interface ProgramDescription {
  description: string;
}

/**
 * Parse the charitable programs CSV.
 * This CSV typically has columns: BN, program description, program type, etc.
 */
function parseProgramsCsv(csvText: string): Map<string, ProgramDescription[]> {
  const programsByBn = new Map<string, ProgramDescription[]>();
  if (!csvText || csvText.trim().length === 0) return programsByBn;

  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length < 2) return programsByBn;

  const header = parseCsvLine(lines[0]);
  const headerLower = header.map(h => normalizeHeader(h));

  // Detect columns
  const bnIdx = findColumnIndex(headerLower, ['bn', 'business number', 'registration number']);
  const descIdx = findColumnIndex(headerLower, ['description', 'program description', 'program name',
    'charitable activity', 'charitable program', 'activity description']);

  if (bnIdx < 0) return programsByBn;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const row = parseCsvLine(line);
      const bn = safeTrim(row[bnIdx]);
      if (!bn) continue;

      const description = descIdx >= 0 ? safeTrim(row[descIdx]) || '' : '';

      if (!programsByBn.has(bn)) {
        programsByBn.set(bn, []);
      }
      if (description) {
        programsByBn.get(bn)!.push({ description });
      }
    } catch {
      // Skip malformed rows
    }
  }

  return programsByBn;
}


/**
 * Join multiple program descriptions into a single text block.
 */
function joinProgramDescriptions(programs: ProgramDescription[]): string | null {
  if (programs.length === 0) return null;
  return programs
    .map(p => p.description.trim())
    .filter(Boolean)
    .join('\n---\n')
    .substring(0, 5000) || null;
}


/**
 * Parse CSV text into an array of row records keyed by column aliases.
 */
function parseCsvToRows(
  csvText: string,
  columnAliases: Record<string, string>,
): Record<string, string>[] {
  if (!csvText || csvText.trim().length === 0) return [];

  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]);
  const headerLower = header.map(h => normalizeHeader(h));

  // Build a mapping: [column index] -> canonical field name
  const columnMap: (string | null)[] = headerLower.map((h, i) => {
    // Try exact match first
    if (columnAliases[h]) return columnAliases[h];

    // Try contains match
    for (const [pattern, canonical] of Object.entries(columnAliases)) {
      if (h.includes(pattern)) return canonical;
    }

    return null;
  });

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const fields = parseCsvLine(line);
      const row: Record<string, string> = {};

      for (let j = 0; j < fields.length; j++) {
        const canonical = columnMap[j];
        if (canonical) {
          const value = safeTrim(fields[j]);
          if (value) {
            row[canonical] = value;
          }
        }
      }

      if (row['bn'] || row['legal_name']) {
        rows.push(row);
      }
    } catch {
      // Skip malformed rows
    }
  }

  return rows;
}


/**
 * Index parsed rows by BN for join operations.
 */
function indexByBn(rows: Record<string, string>[]): Map<string, Record<string, string>> {
  const map = new Map<string, Record<string, string>>();
  for (const row of rows) {
    const bn = row['bn']?.trim();
    if (bn) {
      // Last one wins if duplicate (shouldn't happen within a single CSV)
      map.set(bn, row);
    }
  }
  return map;
}


/* ------------------------------------------------------------------ */
/*  Column Detection Helpers                                           */
/* ------------------------------------------------------------------ */

function findColumnIndex(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.indexOf(candidate);
    if (idx >= 0) return idx;

    // Try contains match
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].includes(candidate)) return i;
    }
  }
  return -1;
}


function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[-_./]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


/* ------------------------------------------------------------------ */
/*  CSV Line Parser                                                    */
/* ------------------------------------------------------------------ */




/* ------------------------------------------------------------------ */
/*  Value Parsers                                                      */
/* ------------------------------------------------------------------ */

function safeTrim(val: string | undefined): string {
  if (!val) return '';
  return val.replace(/^[\"'\s]+|[\"'\s]+$/g, '').trim();
}

function parseCurrency(val: string | undefined): number | null {
  if (!val) return null;
  const cleaned = val
    .replace(/[$,€£\s]/g, '')
    .replace(/^["']|["']$/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === 'N/A') return null;
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

function parseCategory(val: string | undefined): CharityCategory {
  if (!val) return CharityCategory.Other;
  const normalized = val.toLowerCase().trim();

  if (normalized.includes('charitable organization')) return CharityCategory.CharitableOrganization;
  if (normalized.includes('public foundation')) return CharityCategory.PublicFoundation;
  if (normalized.includes('private foundation')) return CharityCategory.PrivateFoundation;
  if (normalized.includes('foundation')) return CharityCategory.PrivateFoundation;

  return CharityCategory.Other;
}

function parseStatus(val: string | undefined): CharityStatus {
  if (!val) return CharityStatus.Unknown;
  const trimmed = val.trim();
  return CRA_STATUS_MAP[trimmed] || CharityStatus.Unknown;
}


export {
  parseCsvLine,
  parseCurrency,
  normalizeHeader,
};
