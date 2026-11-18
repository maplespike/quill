// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Federal Budget Parser — Quill
 *
 * Parses CSV, HTML, and JSON data from Canadian federal budget sources
 * into the unified BudgetRecord schema.
 *
 * Parsers:
 *   - parseBudgetCSV(csv) — Parse generic budget CSV data from CKAN
 *   - parsePublicAccounts(csv) — Parse Public Accounts CSV data
 *   - parseFiscalMonitorCSV(csv) — Parse Fiscal Monitor CSV data
 *   - parseDepartmentalPlanCSV(csv) — Parse Departmental Plan listings
 *   - parseCKAResult(pkg) — Parse a CKAN package result into records
 *   - parseHTMLDocumentLinks(html, baseUrl) — Extract document links from HTML
 */

import { computeHash } from '../../verification/hashing.js';
import { normalizeFiscalYear } from './fetcher.js';
import {
  ALL_BUDGET_CATEGORIES,
  FEDERAL_DEPARTMENTS,
  DEPARTMENT_ACRONYM_MAP,
  DEPARTMENT_NAME_MAP,
} from './constants.js';
import type {
  BudgetRecord,
  BudgetRecordType,
  BudgetCategory,
  RawPublicAccountsRow,
  RawFiscalMonitorRow,
  RawDepartmentalPlanRow,
  CKANPackage,
  CKANResource,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Helper Functions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Detect budget category from a description/title string.
 */
export function detectCategory(text: string): BudgetCategory {
  const lower = text.toLowerCase().trim();

  // Revenue categories
  if (/\b(personal income tax|pit|corporate income tax|cit|gst|hst|excise|customs|tariff|revenue|non-tax)\b/.test(lower)) return 'revenue';
  if (/\b(tax\s*revenue|taxation)\b/.test(lower)) return 'revenue';
  if (/\b(other\s+revenue|miscellaneous\s+revenue)\b/.test(lower)) return 'other-revenue';

  // Expense categories
  if (/\b(debt\s+service|public\s+debt\s+charge|interest\s+on\s+debt)\b/.test(lower)) return 'debt-service';
  if (/\b(defence|defense|military|national\s+defence|dnd)\b/.test(lower)) return 'defense';
  if (/\b(health|medical|pharmacare|dental\s+care|healthcare)\b/.test(lower)) return 'healthcare';
  if (/\b(elderly|oas|old\s+age\s+security|gis|guaranteed\s+income|seniors)\b/.test(lower)) return 'social';
  if (/\b(employment\s+insurance|ei|worker|labour|workforce)\b/.test(lower)) return 'social';
  if (/\b(social|poverty|affordable\s+housing|child\s+benefit|ccb)\b/.test(lower)) return 'social';
  if (/\b(education|training|student|learning|school|post-secondary|scholarship)\b/.test(lower)) return 'education';
  if (/\b(infrastructure|bridge|road|transit|public\s+transit|highway)\b/.test(lower)) return 'infrastructure';
  if (/\b(indigenous|first\s+nation|inuit|metis|native)\b/.test(lower)) return 'indigenous';
  if (/\b(climate|environment|green|emission|clean\s+energy|renewable|net-zero|paris\s+agreement)\b/.test(lower)) return 'climate';
  if (/\b(innovation|research|development|rd|science|technology|tech|space|ai|artificial\s+intelligence)\b/.test(lower)) return 'innovation';
  if (/\b(immigration|refugee|settlement|citizenship|ircc|asylum)\b/.test(lower)) return 'immigration';
  if (/\b(public\s+safety|police|rcmp|emergency|disaster|fire|corrections|border\s+security)\b/.test(lower)) return 'public-safety';
  if (/\b(culture|heritage|art|museum|broadcast|sport|media)\b/.test(lower)) return 'culture';
  if (/\b(pension|superannuation|retirement)\b/.test(lower)) return 'pension';
  if (/\b(transfer|transfer\s+payment|grant|contribution|subsidy)\b/.test(lower)) return 'transfer';
  if (/\b(capital|asset|investment|amortization|depreciation)\b/.test(lower)) return 'capital';
  if (/\b(operating|operation|admin|administration|salary|wage|compensation|employee)\b/.test(lower)) return 'operating';

  // Aggregate categories
  if (/\b(total\s+revenue|total\s+income)\b/.test(lower)) return 'total';
  if (/\b(total\s+expense|total\s+spending|program\s+expense)\b/.test(lower)) return 'total';
  if (/\b(budgetary\s+balance|deficit|surplus|fiscal\s+balance)\b/.test(lower)) return 'deficit';
  if (/\b(federal\s+debt|accumulated\s+deficit|net\s+debt)\b/.test(lower)) return 'debt';
  if (/\b(gdp|gross\s+domestic\s+product|economic\s+growth)\b/.test(lower)) return 'gdp';
  if (/\b(expense|spending|program)\b/.test(lower)) return 'expense';

  return 'unallocated';
}

/**
 * Detect budget record type from a title/description string.
 */
export function detectRecordType(text: string): BudgetRecordType {
  const lower = text.toLowerCase().trim();

  if (/\b(budget\s+plan|budget\s+in\s+brief|federal\s+budget|budget\s+202)\b/.test(lower)) return 'budget';
  if (/\b(public\s+accounts|public\s+account)\b/.test(lower)) return 'public_accounts';
  if (/\b(fiscal\s+monitor|monthly\s+fiscal)\b/.test(lower)) return 'fiscal_monitor';
  if (/\b(departmental\s+plan|departmental\s+results|results\s+report)\b/.test(lower)) return 'departmental_plan';
  if (/\b(fiscal\s+projection|economic\s+outlook|fiscal\s+outlook|projection)\b/.test(lower)) return 'fiscal_projections';
  if (/\b(supplementary\s+estimates?)\b/.test(lower)) return 'supplementary_estimates';
  if (/\b(main\s+estimates?)\b/.test(lower)) return 'main_estimates';

  return 'other';
}

/**
 * Parse a numeric amount from a string, returning null if unparseable.
 * Handles: "1,234", "1.2B", "1.2M", "(1,234)" for negatives, etc.
 */
export function parseAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;

  const trimmed = value.trim();
  if (!trimmed) return null;

  let negative = false;
  let clean = trimmed;

  // Handle parenthetical negatives: (1,234) => -1234
  if (clean.startsWith('(') && clean.endsWith(')')) {
    negative = true;
    clean = clean.slice(1, -1);
  }
  if (clean.startsWith('-')) {
    negative = true;
    clean = clean.slice(1);
  }

  // Remove commas and whitespace
  clean = clean.replace(/,/g, '').trim();

  // Handle suffixed values: B, M, K
  let multiplier = 1;
  const upper = clean.toUpperCase();
  if (/B$/.test(upper)) { multiplier = 1_000_000_000; clean = clean.slice(0, -1); }
  else if (/M$/.test(upper)) { multiplier = 1_000_000; clean = clean.slice(0, -1); }
  else if (/K$/.test(upper)) { multiplier = 1_000; clean = clean.slice(0, -1); }

  const num = parseFloat(clean);
  if (isNaN(num)) return null;

  return (negative ? -1 : 1) * num * multiplier;
}

/**
 * Detect department acronym from a text string.
 */
export function detectDepartmentAcronym(text: string): string | null {
  const lower = text.toLowerCase();
  for (const dept of FEDERAL_DEPARTMENTS) {
    if (lower.includes(dept.acronym.toLowerCase())) return dept.acronym;
    // Check first part of name
    const firstWord = dept.name.toLowerCase().split(' ')[0];
    if (lower.includes(firstWord)) return dept.acronym;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  CSV Parsers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Parse generic budget CSV data into BudgetRecord array.
 *
 * The CSV is expected to have columns like:
 *   Fiscal Year, Department, Category, Amount, Description
 *
 * @param csv - Raw CSV text content
 * @param options - Parsing options
 * @returns Array of BudgetRecord
 */
export async function parseBudgetCSV(
  csv: string,
  options: {
    sourceUrl?: string;
    recordType?: BudgetRecordType;
    fiscalYear?: string;
  } = {},
): Promise<BudgetRecord[]> {
  const now = new Date().toISOString();
  const records: BudgetRecord[] = [];
  const seenHashes = new Set<string>();

  // Split into lines and parse header
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]);
  const colMap = buildColumnMap(header);

  for (let i = 1; i < lines.length; i++) {
    try {
      const cells = parseCSVLine(lines[i]);
      if (cells.length < 2) continue;

      const row: RawPublicAccountsRow = {};
      for (let j = 0; j < cells.length && j < header.length; j++) {
        row[header[j]] = cells[j];
      }

      const fiscalYear = options.fiscalYear ?? String(row['Fiscal Year'] ?? row['fiscal_year'] ?? '');
      const normalizedYear = fiscalYear ? normalizeFiscalYear(String(fiscalYear)) : '';

      // Detect category and amount
      const description = String(row['Description'] ?? row['description'] ?? row['Category'] ?? row['category'] ?? '');
      const category = detectCategory(description);
      const rawAmount = row['Amount'] ?? row['amount'] ?? row['Value'] ?? row['value'] ?? null;
      const amount = parseAmount(rawAmount as string | number | null | undefined);
      const department = String(row['Department'] ?? row['department'] ?? row['Organization'] ?? row['organization'] ?? '');
      const deptAcrRaw = row['Department Acronym'] ?? row['department_acronym'] ?? '';
      const departmentAcr = detectDepartmentAcronym(department) || String(deptAcrRaw);

      const hashContent = `budget-csv|${normalizedYear}|${department}|${category}|${amount}|${description}`;
      const id = await computeHash(hashContent, 'sha256');
      if (seenHashes.has(id)) continue;
      seenHashes.add(id);

      records.push({
        id,
        fiscalYear: normalizedYear,
        recordType: options.recordType ?? detectRecordType(description) as BudgetRecordType,
        department: department || null,
        departmentAcronym: departmentAcr || null,
        category,
        amount,
        currency: 'CAD',
        description: description || null,
        title: String(row['Title'] ?? row['title'] ?? '') || null,
        publishedDate: null,
        fiscalQuarter: null,
        sourceUrl: options.sourceUrl ?? '',
        sourceSystem: 'budget-csv-parser',
        ckanPackageId: null,
        ckanResourceId: null,
        language: null,
        ingestedAt: now,
      });
    } catch (err) {
      console.warn(`[Budget Parser] Skipping CSV row ${i}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return records;
}

/**
 * Parse Public Accounts CSV data into BudgetRecord array.
 *
 * Public Accounts CSV format (varies by year):
 *   Department, Department Acronym, Fiscal Year, Category, Amount, Description, Vote, Appropriation Type
 *
 * @param csv - Raw CSV text content
 * @param options - Parsing options
 * @returns Array of BudgetRecord
 */
export async function parsePublicAccounts(
  csv: string,
  options: {
    sourceUrl?: string;
    fiscalYear?: string;
  } = {},
): Promise<BudgetRecord[]> {
  const records = await parseBudgetCSV(csv, {
    ...options,
    recordType: 'public_accounts',
  });

  // Add source system and override record type
  for (const record of records) {
    record.recordType = 'public_accounts';
    record.sourceSystem = 'public-accounts-csv';
  }

  return records;
}

/**
 * Parse Fiscal Monitor CSV data.
 *
 * Fiscal Monitor format:
 *   Period, Fiscal Year, Category, Amount, Type, Description
 *
 * @param csv - Raw CSV text content
 * @param options - Parsing options
 * @returns Array of BudgetRecord
 */
export async function parseFiscalMonitorCSV(
  csv: string,
  options: {
    sourceUrl?: string;
    fiscalYear?: string;
  } = {},
): Promise<BudgetRecord[]> {
  const now = new Date().toISOString();
  const records: BudgetRecord[] = [];
  const seenHashes = new Set<string>();

  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]);
  const colMap = buildColumnMap(header);

  for (let i = 1; i < lines.length; i++) {
    try {
      const cells = parseCSVLine(lines[i]);
      if (cells.length < 2) continue;

      const row: RawFiscalMonitorRow = {};
      for (let j = 0; j < cells.length && j < header.length; j++) {
        row[header[j]] = cells[j];
      }

      const fiscalYear = options.fiscalYear ?? String(row['Fiscal Year'] ?? row['fiscal_year'] ?? '');
      const normalizedYear = fiscalYear ? normalizeFiscalYear(fiscalYear) : '';

      const description = String(row['Description'] ?? row['Category'] ?? row['category'] ?? '');
      const category = detectCategory(description);
      const rawAmt = row['Amount'] ?? row['amount'] ?? null;
      const amount = parseAmount(rawAmt as string | number | null | undefined);
      const period = String(row['Period'] ?? row['period'] ?? '');

      const hashContent = `fm-csv|${normalizedYear}|${period}|${category}|${amount}|${description}`;
      const id = await computeHash(hashContent, 'sha256');
      if (seenHashes.has(id)) continue;
      seenHashes.add(id);

      records.push({
        id,
        fiscalYear: normalizedYear,
        recordType: 'fiscal_monitor',
        department: 'Department of Finance Canada',
        departmentAcronym: 'FIN',
        category,
        amount,
        currency: 'CAD',
        description: description || null,
        title: description || null,
        publishedDate: period || null,
        fiscalQuarter: null,
        sourceUrl: options.sourceUrl ?? '',
        sourceSystem: 'fiscal-monitor-csv',
        ckanPackageId: null,
        ckanResourceId: null,
        language: null,
        ingestedAt: now,
      });
    } catch (err) {
      console.warn(`[Budget Parser] Skipping FM CSV row ${i}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return records;
}

/**
 * Parse Departmental Plan CSV/JSON data into BudgetRecord array.
 *
 * @param records - Array of raw departmental plan rows
 * @param options - Parsing options
 * @returns Array of BudgetRecord
 */
export async function parseDepartmentalPlanRecords(
  records: RawDepartmentalPlanRow[],
  options: {
    sourceUrl?: string;
    fiscalYear?: string;
  } = {},
): Promise<BudgetRecord[]> {
  const now = new Date().toISOString();
  const result: BudgetRecord[] = [];
  const seenHashes = new Set<string>();

  for (const row of records) {
    try {
      const fiscalYear = options.fiscalYear ?? String(row['Fiscal Year'] ?? row['fiscal_year'] ?? '');
      const normalizedYear = fiscalYear ? normalizeFiscalYear(fiscalYear) : '';

      const orgName = String(row['Organization'] ?? row['organization'] ?? '');
      const docType = String(row['Document Type'] ?? row['document_type'] ?? 'Departmental Plan');
      const title = String(row['Title'] ?? row['title'] ?? '');
      const url = String(row['URL'] ?? row['url'] ?? '');

      const departmentAcr = detectDepartmentAcronym(orgName) || orgName;

      const recordType: BudgetRecordType =
        /results\s*report/i.test(docType) ? 'departmental_plan' : 'departmental_plan';

      const hashContent = `dept-plan|${normalizedYear}|${orgName}|${title}|${url}`;
      const id = await computeHash(hashContent, 'sha256');
      if (seenHashes.has(id)) continue;
      seenHashes.add(id);

      result.push({
        id,
        fiscalYear: normalizedYear,
        recordType,
        department: orgName || null,
        departmentAcronym: departmentAcr || null,
        category: 'unallocated',
        amount: null,
        currency: 'CAD',
        description: title || docType || null,
        title: title || null,
        publishedDate: String(row['Published Date'] ?? row['published_date'] ?? '') || null,
        fiscalQuarter: null,
        sourceUrl: (url || options.sourceUrl) ?? '',
        sourceSystem: 'departmental-plans-parser',
        ckanPackageId: null,
        ckanResourceId: null,
        language: null,
        ingestedAt: now,
      });
    } catch (err) {
      console.warn(`[Budget Parser] Skipping DP row: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  CKAN Parser                                                       */
/* ------------------------------------------------------------------ */

/**
 * Parse a CKAN package into BudgetRecord array.
 * Creates records for each resource in the package with appropriate metadata.
 *
 * @param pkg - CKAN package from open.canada.ca
 * @param recordType - Override record type (auto-detected if omitted)
 * @returns Array of BudgetRecord
 */
export async function parseCKANPackage(
  pkg: CKANPackage,
  recordType?: BudgetRecordType,
): Promise<BudgetRecord[]> {
  const now = new Date().toISOString();
  const records: BudgetRecord[] = [];
  const seenHashes = new Set<string>();

  const detectedType = recordType ?? detectRecordType(pkg.title + ' ' + (pkg.notes ?? ''));
  const fiscalYear = extractFourDigitYear(pkg.title + ' ' + (pkg.notes ?? ''));
  const departmentName = pkg.organization?.title ?? null;
  const departmentAcr = pkg.organization?.name ?? null;

  for (const resource of pkg.resources) {
    try {
      const hashContent = `ckan|${pkg.id}|${resource.id}|${resource.url}`;
      const id = await computeHash(hashContent, 'sha256');
      if (seenHashes.has(id)) continue;
      seenHashes.add(id);

      const nameLower = (resource.name ?? '').toLowerCase();
      const category = detectCategory(resource.name ?? '');
      const amount = parseAmount(resource.size ?? null);

      records.push({
        id,
        fiscalYear: fiscalYear ?? '',
        recordType: detectedType,
        department: departmentName,
        departmentAcronym: departmentAcr,
        category,
        amount,
        currency: 'CAD',
        description: resource.name || null,
        title: resource.name || null,
        publishedDate: resource.created || null,
        fiscalQuarter: null,
        sourceUrl: resource.url,
        sourceSystem: 'ckan-package',
        ckanPackageId: pkg.id,
        ckanResourceId: resource.id,
        language: nameLower.includes('fr') ? 'fr' : 'en',
        ingestedAt: now,
      });
    } catch (err) {
      console.warn(`[Budget Parser] Skipping CKAN resource "${resource.name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  HTML Link Parsing                                                  */
/* ------------------------------------------------------------------ */

/**
 * Parse HTML document links into BudgetRecord array.
 * Used for budget listing pages, departmental plan portals, etc.
 *
 * @param links - Array of { url, text } extracted from HTML
 * @param sourceUrl - Source URL of the listing page
 * @param options - Parsing options
 * @returns Array of BudgetRecord
 */
export async function parseDocumentLinks(
  links: Array<{ url: string; text: string }>,
  sourceUrl: string,
  options: {
    recordType?: BudgetRecordType;
    fiscalYear?: string;
    department?: string;
    departmentAcronym?: string;
  } = {},
): Promise<BudgetRecord[]> {
  const now = new Date().toISOString();
  const records: BudgetRecord[] = [];
  const seenHashes = new Set<string>();

  for (const link of links) {
    try {
      const hashContent = `html-link|${link.url}|${link.text}|${sourceUrl}`;
      const id = await computeHash(hashContent, 'sha256');
      if (seenHashes.has(id)) continue;
      seenHashes.add(id);

      const desc = link.text;
      const category = detectCategory(desc);
      const recordType = options.recordType ?? detectRecordType(desc);
      const fiscalYear = options.fiscalYear ?? extractFourDigitYear(desc + ' ' + link.url) ?? '';

      records.push({
        id,
        fiscalYear,
        recordType,
        department: options.department ?? null,
        departmentAcronym: options.departmentAcronym ?? null,
        category,
        amount: null,
        currency: 'CAD',
        description: desc || null,
        title: link.text || null,
        publishedDate: null,
        fiscalQuarter: null,
        sourceUrl: link.url,
        sourceSystem: 'html-listing-parser',
        ckanPackageId: null,
        ckanResourceId: null,
        language: link.url.toLowerCase().includes('fra') ? 'fr' : 'en',
        ingestedAt: now,
      });
    } catch (err) {
      console.warn(`[Budget Parser] Skipping link "${link.text}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  CSV Parsing Utilities                                              */
/* ------------------------------------------------------------------ */

/**
 * Parse a single CSV line into cells, handling quoted fields.
 */
export function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++; // skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  cells.push(current.trim());

  return cells;
}

/**
 * Build a column index map from CSV header array.
 */
export function buildColumnMap(header: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (let i = 0; i < header.length; i++) {
    const col = header[i].toLowerCase().replace(/[\s_-]+/g, '_').replace(/^["']|["']$/g, '').trim();
    map[col] = i;

    // Also store with original casing as key
    const orig = header[i].replace(/^["']|["']$/g, '').trim();
    map[orig] = i;
  }
  return map;
}

/**
 * Extract a 4-digit year from text.
 */
function extractFourDigitYear(text: string): string | null {
  const match = text.match(/\b(20\d{2})\b/);
  return match ? match[1] : null;
}
