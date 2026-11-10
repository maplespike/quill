// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Utility Parser — Quill
 *
 * Parses Canadian utility provider data (hydro, gas, telecom) into structured records
 * with field extraction, normalization, and deduplication.
 *
 * Parsers:
 *   - parseHydroRecord() — Parse hydro utility data from text/CSV
 *   - parseGasRecord() — Parse natural gas utility data from text/CSV
 *   - parseUtilityRecords() — Batch parser for multiple utility record types
 */

import { computeHash } from '../../verification/hashing.js';
import type { HydroRecord, GasRecord, UtilityParsedRecord, UtilityParserOptions, UtilityType } from './types.js';

/* ------------------------------------------------------------------ */
/*  Helper Functions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Normalize province names to standard Canadian abbreviations.
 */
export function normalizeProvince(name: string | null | undefined): string | null {
  if (!name) return null;

  const normalized = name.trim().toLowerCase();

  const provinceMap: Record<string, string> = {
    alberta: 'AB',
    alb: 'AB',
    ab: 'AB',
    'british columbia': 'BC',
    'b.c.': 'BC',
    bc: 'BC',
    manitoba: 'MB',
    man: 'MB',
    mb: 'MB',
    'new brunswick': 'NB',
    'n.b.': 'NB',
    nb: 'NB',
    'newfoundland and labrador': 'NL',
    newfoundland: 'NL',
    nfld: 'NL',
    'n.l.': 'NL',
    nl: 'NL',
    'nova scotia': 'NS',
    'n.s.': 'NS',
    ns: 'NS',
    ontario: 'ON',
    ont: 'ON',
    on: 'ON',
    'prince edward island': 'PE',
    'p.e.i.': 'PE',
    pei: 'PE',
    pe: 'PE',
    quebec: 'QC',
    québec: 'QC',
    que: 'QC',
    qc: 'QC',
    saskatchewan: 'SK',
    sask: 'SK',
    sk: 'SK',
    'northwest territories': 'NT',
    'n.w.t.': 'NT',
    nt: 'NT',
    nunavut: 'NU',
    nun: 'NU',
    nu: 'NU',
    yukon: 'YT',
    'yukon territory': 'YT',
    yt: 'YT',
  };

  return provinceMap[normalized] || name.trim();
}

/**
 * Normalize utility names to standard format (title case, remove extra whitespace).
 */
export function normalizeUtilityName(name: string | null | undefined): string | null {
  if (!name) return null;

  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Normalize rate type to standard values.
 */
export function normalizeRateType(rateType: string | null | undefined): string | null {
  if (!rateType) return null;

  const normalized = rateType.trim().toLowerCase();

  const rateTypeMap: Record<string, string> = {
    residential: 'residential',
    'res': 'residential',
    'resi': 'residential',
    commercial: 'commercial',
    'com': 'commercial',
    'comm': 'commercial',
    industrial: 'industrial',
    'ind': 'industrial',
    'rural': 'residential',
    urban: 'residential',
    business: 'commercial',
    small: 'residential',
    large: 'industrial',
    general: 'residential',
  };

  return rateTypeMap[normalized] || rateType.trim();
}

/**
 * Parse a numeric value from a string, handling units and commas.
 */
export function parseNumeric(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const clean = trimmed.replace(/,/g, '').trim();

  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

/**
 * Parse a CSV line into cells, handling quoted fields.
 */
function parseCSVLine(line: string): string[] {
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
 * Extract a numeric field from text using regex patterns.
 */
function extractNumericField(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return parseNumeric(match[1]);
    }
  }
  return null;
}

/**
 * Extract text field from text using regex patterns.
 */
function extractTextField(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Hydro Utility Parser                                               */
/* ------------------------------------------------------------------ */

/**
 * Parse hydro utility data from text/CSV into structured HydroRecord objects.
 *
 * Expected fields (flexible extraction from text):
 *   - Utility name: e.g., "Hydro One", "BC Hydro"
 *   - Province: Canadian province abbreviation or full name
 *   - Customer count: number of customers
 *   - Generation capacity: MW capacity
 *   - Rate type: residential/commercial/industrial
 *   - Average rate: ¢/kWh or $/kWh
 *   - Source URL: where data came from
 *
 * @param text - Raw text or CSV content
 * @param options - Parsing options
 * @returns Array of HydroRecord
 */
export async function parseHydroRecord(
  text: string,
  options: UtilityParserOptions = {},
): Promise<HydroRecord[]> {
  const now = new Date().toISOString();
  const records: HydroRecord[] = [];
  const seenHashes = new Set<string>();

  // Check if this looks like CSV data
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length > 1 && lines[0].includes(',')) {
    // Parse as CSV
    return await parseHydroCSV(text, options);
  } else {
    // Parse as free-form text
    return await parseHydroText(text, options);
  }
}

/**
 * Parse hydro utility data from CSV format.
 */
async function parseHydroCSV(
  csv: string,
  options: UtilityParserOptions,
): Promise<HydroRecord[]> {
  const now = new Date().toISOString();
  const records: HydroRecord[] = [];
  const seenHashes = new Set<string>();

  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]);
  const headerLower = header.map((h) => h.toLowerCase());

  const getColIndex = (names: string[]): number => {
    for (const name of names) {
      const idx = headerLower.indexOf(name.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const nameIdx = getColIndex(['utility', 'name', 'provider', 'company', 'utility name']);
  const provinceIdx = getColIndex(['province', 'prov', 'province/territory', 'jurisdiction', 'province code']);
  const customerCountIdx = getColIndex(['customers', 'customer count', 'customer', 'customers count']);
  const capacityIdx = getColIndex(['capacity', 'generation capacity', 'generation', 'mw', 'capacity mw']);
  const rateTypeIdx = getColIndex(['rate type', 'rate', 'type', 'customer type', 'rate class']);
  const avgRateIdx = getColIndex(['average rate', 'avg rate', 'rate', 'price', 'rate cents', 'rate $/kwh']);

  for (let i = 1; i < lines.length; i++) {
    try {
      const cells = parseCSVLine(lines[i]);
      if (cells.length < 2) continue;

      const getCell = (idx: number): string | null => {
        return idx !== -1 && cells[idx] ? cells[idx].trim() : null;
      };

      const name = normalizeUtilityName(getCell(nameIdx));
      const province = normalizeProvince(getCell(provinceIdx));
      const customerCount = parseNumeric(getCell(customerCountIdx));
      const generationCapacityMW = parseNumeric(getCell(capacityIdx));
      const rateType = normalizeRateType(getCell(rateTypeIdx));
      const avgRateRaw = getCell(avgRateIdx);
      let averageRate = parseNumeric(avgRateRaw);

      // Convert $/kWh to ¢/kWh if detected
      if (avgRateRaw && avgRateRaw.toLowerCase().includes('$')) {
        const num = parseNumeric(avgRateRaw);
        if (num !== null) {
          averageRate = num * 100; // $/kWh to ¢/kWh
        }
      }

      if (!name || !province) continue;

      const hashContent = `hydro|${name}|${province}|${customerCount}|${generationCapacityMW}|${rateType}|${averageRate}`;
      const id = await computeHash(hashContent, 'sha256');
      if (seenHashes.has(id)) continue;
      seenHashes.add(id);

      records.push({
        id,
        name,
        province,
        customerCount,
        generationCapacityMW,
        rateType,
        averageRate,
        sourceUrl: options.sourceUrl ?? '',
        utilityType: 'hydro',
        ingestedAt: now,
      });
    } catch (err) {
      console.warn(`[Hydro CSV Parser] Skipping CSV row ${i}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return records;
}

/**
 * Parse hydro utility data from free-form text.
 */
async function parseHydroText(
  text: string,
  options: UtilityParserOptions,
): Promise<HydroRecord[]> {
  const now = new Date().toISOString();
  const records: HydroRecord[] = [];
  const seenHashes = new Set<string>();

  // Split text into potential records (by double newlines or known utility names)
  const recordBlocks = text.split(/\n\n+/).filter((block) => block.trim().length > 0);

  for (const block of recordBlocks) {
    try {
      // Extract utility name (common patterns)
      const namePatterns = [
        /(?:utility|provider|company)[:\s]+([A-Z][A-Za-z\s&]+)/i,
        /^(Hydro\s+[\w&\s]+|[\w&]+\s+Hydro)/im,
        /(?:Name|Utility\s*Name)[:\s]+([A-Z][A-Za-z\s&]+)/i,
      ];
      const name = normalizeUtilityName(extractTextField(block, namePatterns));

      // Extract province
      const provincePatterns = [
        /(?:Province|Province\s*Code)[:\s]+([A-Za-z]+)/i,
        /(?:located|serving|in|for)\s+([A-Za-z\s]+?)(?:,|\.|\s+utility|\s+customers)/i,
      ];
      const province = normalizeProvince(extractTextField(block, provincePatterns));

      if (!name || !province) continue;

      // Extract customer count
      const customerCountPatterns = [
        /(?:customers|customer\s*count)[:\s]+([\d,]+)/i,
        /serving\s+([\d,]+)\s+customers/i,
        /(\d+(?:,\d+)*)\s+customers/i,
      ];
      const customerCount = extractNumericField(block, customerCountPatterns);

      // Extract generation capacity (MW)
      const capacityPatterns = [
        /(?:generation\s*capacity|capacity)[:\s]+([\d,]+)\s*MW/i,
        /(\d+(?:,\d+)*)\s*MW\s*(?:capacity|generation)/i,
        /capacity\s*of\s+([\d,]+)\s*MW/i,
      ];
      const generationCapacityMW = extractNumericField(block, capacityPatterns);

      // Extract rate type
      const rateTypePatterns = [
        /(?:rate\s*type|customer\s*type)[:\s]+(residential|commercial|industrial)/i,
        /(residential|commercial|industrial)\s+rate/i,
      ];
      const rateType = normalizeRateType(extractTextField(block, rateTypePatterns));

      // Extract average rate (¢/kWh or $/kWh)
      const avgRatePatterns = [
        /(?:average\s*rate|rate)[:\s]+([\d.]+)\s*¢\/kWh/i,
        /(?:average\s*rate|rate)[:\s]+\$([\d.]+)\s*\/\s*kWh/i,
        /([\d.]+)\s*¢\/kWh/i,
        /\$([\d.]+)\s*\/\s*kWh/i,
      ];
      let averageRate = extractNumericField(block, avgRatePatterns);

      // Check if $/kWh format and convert to ¢/kWh
      if (averageRate === null) {
        const dollarPattern = /(?:average\s*rate|rate)[:\s]+\$([\d.]+)/i;
        const dollarMatch = block.match(dollarPattern);
        if (dollarMatch && dollarMatch[1]) {
          averageRate = parseNumeric(dollarMatch[1])! * 100;
        }
      }

      const hashContent = `hydro|${name}|${province}|${customerCount}|${generationCapacityMW}|${rateType}|${averageRate}`;
      const id = await computeHash(hashContent, 'sha256');
      if (seenHashes.has(id)) continue;
      seenHashes.add(id);

      records.push({
        id,
        name,
        province,
        customerCount,
        generationCapacityMW,
        rateType,
        averageRate,
        sourceUrl: options.sourceUrl ?? '',
        utilityType: 'hydro',
        ingestedAt: now,
      });
    } catch (err) {
      console.warn(`[Hydro Text Parser] Skipping record block: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Natural Gas Utility Parser                                         */
/* ------------------------------------------------------------------ */

/**
 * Parse natural gas utility data from text/CSV into structured GasRecord objects.
 *
 * Expected fields (flexible extraction from text):
 *   - Utility name: e.g., "Enbridge Gas", "Fortis BC"
 *   - Province: Canadian province abbreviation or full name
 *   - Customer count: number of customers
 *   - Distribution volume: gas volume distributed
 *   - Rate type: residential/commercial/industrial
 *   - Average rate: rate per unit
 *   - Source URL: where data came from
 *
 * @param text - Raw text or CSV content
 * @param options - Parsing options
 * @returns Array of GasRecord
 */
export async function parseGasRecord(
  text: string,
  options: UtilityParserOptions = {},
): Promise<GasRecord[]> {
  const now = new Date().toISOString();
  const records: GasRecord[] = [];
  const seenHashes = new Set<string>();

  // Check if this looks like CSV data
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length > 1 && lines[0].includes(',')) {
    // Parse as CSV
    return await parseGasCSV(text, options);
  } else {
    // Parse as free-form text
    return await parseGasText(text, options);
  }
}

/**
 * Parse natural gas utility data from CSV format.
 */
async function parseGasCSV(
  csv: string,
  options: UtilityParserOptions,
): Promise<GasRecord[]> {
  const now = new Date().toISOString();
  const records: GasRecord[] = [];
  const seenHashes = new Set<string>();

  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]);
  const headerLower = header.map((h) => h.toLowerCase());

  const getColIndex = (names: string[]): number => {
    for (const name of names) {
      const idx = headerLower.indexOf(name.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const nameIdx = getColIndex(['utility', 'name', 'provider', 'company', 'utility name']);
  const provinceIdx = getColIndex(['province', 'prov', 'province/territory', 'jurisdiction', 'province code']);
  const customerCountIdx = getColIndex(['customers', 'customer count', 'customer', 'customers count']);
  const volumeIdx = getColIndex(['volume', 'distribution volume', 'distributed', 'gas volume']);
  const rateTypeIdx = getColIndex(['rate type', 'rate', 'type', 'customer type', 'rate class']);
  const avgRateIdx = getColIndex(['average rate', 'avg rate', 'rate', 'price', 'rate gj', 'rate m3']);

  for (let i = 1; i < lines.length; i++) {
    try {
      const cells = parseCSVLine(lines[i]);
      if (cells.length < 2) continue;

      const getCell = (idx: number): string | null => {
        return idx !== -1 && cells[idx] ? cells[idx].trim() : null;
      };

      const name = normalizeUtilityName(getCell(nameIdx));
      const province = normalizeProvince(getCell(provinceIdx));
      const customerCount = parseNumeric(getCell(customerCountIdx));
      const distributionVolume = parseNumeric(getCell(volumeIdx));
      const rateType = normalizeRateType(getCell(rateTypeIdx));
      const averageRate = parseNumeric(getCell(avgRateIdx));

      if (!name || !province) continue;

      const hashContent = `gas|${name}|${province}|${customerCount}|${distributionVolume}|${rateType}|${averageRate}`;
      const id = await computeHash(hashContent, 'sha256');
      if (seenHashes.has(id)) continue;
      seenHashes.add(id);

      records.push({
        id,
        name,
        province,
        customerCount,
        distributionVolume,
        rateType,
        averageRate,
        sourceUrl: options.sourceUrl ?? '',
        utilityType: 'gas',
        ingestedAt: now,
      });
    } catch (err) {
      console.warn(`[Gas CSV Parser] Skipping CSV row ${i}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return records;
}

/**
 * Parse natural gas utility data from free-form text.
 */
async function parseGasText(
  text: string,
  options: UtilityParserOptions,
): Promise<GasRecord[]> {
  const now = new Date().toISOString();
  const records: GasRecord[] = [];
  const seenHashes = new Set<string>();

  // Split text into potential records (by double newlines or known utility names)
  const recordBlocks = text.split(/\n\n+/).filter((block) => block.trim().length > 0);

  for (const block of recordBlocks) {
    try {
      // Extract utility name
      const namePatterns = [
        /(?:utility|provider|company)[:\s]+([A-Z][A-Za-z\s&]+)/i,
        /^(Gas\s+[\w&\s]+|[\w&]+\s+Gas)/im,
        /(?:Name|Utility\s*Name)[:\s]+([A-Z][A-Za-z\s&]+)/i,
      ];
      const name = normalizeUtilityName(extractTextField(block, namePatterns));

      // Extract province
      const provincePatterns = [
        /(?:Province|Province\s*Code)[:\s]+([A-Za-z]+)/i,
        /(?:located|serving|in|for)\s+([A-Za-z\s]+?)(?:,|\.|\s+utility|\s+customers)/i,
      ];
      const province = normalizeProvince(extractTextField(block, provincePatterns));

      if (!name || !province) continue;

      // Extract customer count
      const customerCountPatterns = [
        /(?:customers|customer\s*count)[:\s]+([\d,]+)/i,
        /serving\s+([\d,]+)\s+customers/i,
        /(\d+(?:,\d+)*)\s+customers/i,
      ];
      const customerCount = extractNumericField(block, customerCountPatterns);

      // Extract distribution volume
      const volumePatterns = [
        /(?:distribution\s*volume|volume|distributed)[:\s]+([\d,]+)\s*(?:m³|m3|GJ|PJ)/i,
        /distributes\s+([\d,]+)\s*(?:m³|m3|GJ|PJ)/i,
        /(\d+(?:,\d+)*)\s*(?:m³|m3|GJ|PJ)\s*(?:distributed|volume)/i,
      ];
      const distributionVolume = extractNumericField(block, volumePatterns);

      // Extract rate type
      const rateTypePatterns = [
        /(?:rate\s*type|customer\s*type)[:\s]+(residential|commercial|industrial)/i,
        /(residential|commercial|industrial)\s+rate/i,
      ];
      const rateType = normalizeRateType(extractTextField(block, rateTypePatterns));

      // Extract average rate
      const avgRatePatterns = [
        /(?:average\s*rate|rate)[:\s]+\$([\d.]+)\s*\/\s*(?:GJ|m³|m3)/i,
        /(?:average\s*rate|rate)[:\s]+([\d.]+)\s*¢\s*\/\s*(?:GJ|m³|m3)/i,
      ];
      const averageRate = extractNumericField(block, avgRatePatterns);

      const hashContent = `gas|${name}|${province}|${customerCount}|${distributionVolume}|${rateType}|${averageRate}`;
      const id = await computeHash(hashContent, 'sha256');
      if (seenHashes.has(id)) continue;
      seenHashes.add(id);

      records.push({
        id,
        name,
        province,
        customerCount,
        distributionVolume,
        rateType,
        averageRate,
        sourceUrl: options.sourceUrl ?? '',
        utilityType: 'gas',
        ingestedAt: now,
      });
    } catch (err) {
      console.warn(`[Gas Text Parser] Skipping record block: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Batch Parser                                                       */
/* ------------------------------------------------------------------ */

/**
 * Parse a batch of utility records, auto-detecting the type.
 *
 * @param rawRecords - Array of raw records with text content and optional type
 * @param options - Parsing options
 * @returns Array of UtilityParsedRecord (mixed types)
 */
export async function parseUtilityRecords(
  rawRecords: Array<{ text?: string; type?: UtilityType; sourceUrl?: string }>,
  options: UtilityParserOptions = {},
): Promise<UtilityParsedRecord[]> {
  const allRecords: UtilityParsedRecord[] = [];

  for (const raw of rawRecords) {
    if (!raw.text) continue;

    const utilityType = raw.type ?? detectUtilityType(raw.text);

    let records: UtilityParsedRecord[] = [];

    try {
      const recordOptions = { ...options, sourceUrl: raw.sourceUrl ?? options.sourceUrl };

      if (utilityType === 'hydro') {
        records = await parseHydroRecord(raw.text, recordOptions);
      } else if (utilityType === 'gas') {
        records = await parseGasRecord(raw.text, recordOptions);
      } else {
        // Default to hydro parser for unknown types (can extend for telecom/water)
        console.warn(`[Utility Batch Parser] Unknown utility type '${utilityType}', defaulting to hydro parser`);
        records = await parseHydroRecord(raw.text, recordOptions);
      }

      allRecords.push(...records);
    } catch (err) {
      console.warn(`[Utility Batch Parser] Skipping record: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return allRecords;
}

/**
 * Detect utility type from text content.
 */
export function detectUtilityType(text: string): UtilityType {
  const lower = text.toLowerCase();

  if (/\b(hydro|electric|electricity|power|kwh|kilowatt|megawatt|mw)\b/.test(lower)) {
    return 'hydro';
  }
  if (/\b(gas|natural gas|gj|m³|m3|distribution volume)\b/.test(lower)) {
    return 'gas';
  }
  if (/\b(telecom|telecommunications|internet|broadband|phone|mobile|wireless)\b/.test(lower)) {
    return 'telecom';
  }
  if (/\b(water|waterworks|sewer|wastewater)\b/.test(lower)) {
    return 'water';
  }

  // Default to hydro if no clear indicators
  return 'hydro';
}