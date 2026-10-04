/**
 * Energy Parser — Quill
 *
 * Parses energy production data from Canada Energy Regulator (CER) CKAN sources
 * into structured records with field extraction, normalization, and deduplication.
 *
 * Parsers:
 *   - parseOilRecord(csv) — Parse oil production/price CSV data
 *   - parseGasRecord(csv) — Parse gas storage/price CSV data
 *   - parseElectricityRecord(csv) — Parse electricity generation CSV data
 *   - parseEnergyBatch(records) — Batch parser for multiple energy record types
 */

import { computeHash } from '../../verification/hashing.js';
import { ENERGY_TOPICS } from './constants.js';
import type { EnergyRecord } from './types.js';

/* ------------------------------------------------------------------ */
/*  Parsed Record Types                                                */
/* ------------------------------------------------------------------ */

export interface OilProductionRecord {
  id: string;
  province: string | null;
  product: string | null;
  volume: number | null;
  volumeUnit: string | null;
  value: number | null;
  valueUnit: string | null;
  period: string | null;
  periodType: string | null;
  sourceUrl: string;
  sourceSystem: string;
  ingestedAt: string;
}

export interface GasStorageRecord {
  id: string;
  province: string | null;
  facility: string | null;
  storageVolume: number | null;
  storageUnit: string | null;
  price: number | null;
  priceUnit: string | null;
  date: string | null;
  sourceUrl: string;
  sourceSystem: string;
  ingestedAt: string;
}

export interface ElectricityGenerationRecord {
  id: string;
  province: string | null;
  fuelType: string | null;
  generationMW: number | null;
  generationUnit: string | null;
  period: string | null;
  periodType: string | null;
  sourceUrl: string;
  sourceSystem: string;
  ingestedAt: string;
}

export interface RenewableEnergyRecord {
  id: string;
  province: string | null;
  energyType: string | null;
  capacity: number | null;
  capacityUnit: string | null;
  period: string | null;
  sourceUrl: string;
  sourceSystem: string;
  ingestedAt: string;
}

export type EnergyParsedRecord =
  | OilProductionRecord
  | GasStorageRecord
  | ElectricityGenerationRecord
  | RenewableEnergyRecord;

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
    canada: 'CA',
    national: 'CA',
    federal: 'CA',
  };

  return provinceMap[normalized] || name.trim();
}

/**
 * Normalize fuel type names to standard values.
 */
export function normalizeFuelType(name: string | null | undefined): string | null {
  if (!name) return null;

  const normalized = name.trim().toLowerCase();

  const fuelTypeMap: Record<string, string> = {
    'crude oil': 'Crude Oil',
    'crude': 'Crude Oil',
    'oil': 'Crude Oil',
    'conventional crude': 'Crude Oil',
    'heavy crude': 'Crude Oil',
    'light crude': 'Crude Oil',
    'synthetic crude': 'Crude Oil',
    'natural gas': 'Natural Gas',
    'gas': 'Natural Gas',
    'ng': 'Natural Gas',
    'conventional gas': 'Natural Gas',
    'shale gas': 'Natural Gas',
    'coal': 'Coal',
    'thermal coal': 'Coal',
    'metallurgical coal': 'Coal',
    'hydro': 'Hydroelectric',
    'hydroelectric': 'Hydroelectric',
    'hydropower': 'Hydroelectric',
    'nuclear': 'Nuclear',
    'wind': 'Wind',
    'wind power': 'Wind',
    'solar': 'Solar',
    'solar power': 'Solar',
    'photovoltaic': 'Solar',
    'biomass': 'Biomass',
    'bioenergy': 'Biomass',
    'geothermal': 'Geothermal',
    'tidal': 'Tidal',
    'wave': 'Wave',
  };

  return fuelTypeMap[normalized] || name.trim();
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
 * Parse a date string to ISO format.
 */
export function parseDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;

  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Try parsing as ISO date
  const isoDate = new Date(trimmed);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.toISOString();
  }

  // Try parsing YYYY-MM
  const yearMonthMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (yearMonthMatch) {
    return `${yearMonthMatch[1]}-${yearMonthMatch[2]}-01`;
  }

  // Try parsing YYYY
  const yearMatch = trimmed.match(/^(\d{4})$/);
  if (yearMatch) {
    return `${yearMatch[1]}-01-01`;
  }

  return trimmed;
}

/**
 * Detect period type from a period string.
 */
export function detectPeriodType(period: string | null): string | null {
  if (!period) return null;

  const lower = period.toLowerCase();

  if (/\b(daily|day)\b/.test(lower)) return 'daily';
  if (/\b(weekly|week)\b/.test(lower)) return 'weekly';
  if (/\b(monthly|month)\b/.test(lower)) return 'monthly';
  if (/\b(quarterly|quarter|q[1-4])\b/.test(lower)) return 'quarterly';
  if (/\b(annual|annually|yearly|year|fy|fiscal)\b/.test(lower)) return 'annual';

  // Try to parse as date
  const dateMatch = period.match(/^\d{4}-\d{2}-\d{2}$/);
  if (dateMatch) return 'daily';

  const yearMonthMatch = period.match(/^\d{4}-\d{2}$/);
  if (yearMonthMatch) return 'monthly';

  const yearMatch = period.match(/^\d{4}$/);
  if (yearMatch) return 'annual';

  return null;
}

/**
 * Detect energy sector from title/description.
 */
export function detectEnergySector(text: string): string {
  const lower = text.toLowerCase();

  if (/\b(crude oil|oil production|petroleum|conventional crude|heavy crude|synthetic crude)\b/.test(lower)) {
    return 'oil';
  }
  if (/\b(natural gas|gas production|gas storage|gas price|conventional gas|shale gas)\b/.test(lower)) {
    return 'gas';
  }
  if (/\b(electricity|electric generation|power generation|generation|mw|megawatt)\b/.test(lower)) {
    return 'electricity';
  }
  if (/\b(renewable|solar|wind|biomass|geothermal|tidal|hydroelectric|hydropower)\b/.test(lower)) {
    return 'renewable';
  }
  if (/\b(mineral|mining|metal|ore)\b/.test(lower)) {
    return 'mining';
  }

  return 'energy';
}

/**
 * Parse a single CSV line into cells, handling quoted fields.
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

/* ------------------------------------------------------------------ */
/*  Oil Production Parser                                             */
/* ------------------------------------------------------------------ */

/**
 * Parse oil production/price CSV data into structured records.
 *
 * Expected CSV columns (varies by dataset):
 *   Province, Product, Volume, VolumeUnit, Value, ValueUnit, Period, PeriodType
 *
 * @param csv - Raw CSV text content
 * @param options - Parsing options
 * @returns Array of OilProductionRecord
 */
export async function parseOilRecord(
  csv: string,
  options: {
    sourceUrl?: string;
    fiscalYear?: string;
  } = {},
): Promise<OilProductionRecord[]> {
  const now = new Date().toISOString();
  const records: OilProductionRecord[] = [];
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

  const provinceIdx = getColIndex(['province', 'prov', 'province/territory', 'jurisdiction']);
  const productIdx = getColIndex(['product', 'commodity', 'type', 'oil type']);
  const volumeIdx = getColIndex(['volume', 'production', 'quantity', 'amount']);
  const volumeUnitIdx = getColIndex(['volume unit', 'unit', 'volumeunit']);
  const valueIdx = getColIndex(['value', 'price', 'revenue', 'cost']);
  const valueUnitIdx = getColIndex(['value unit', 'price unit', 'currency']);
  const periodIdx = getColIndex(['period', 'date', 'time', 'year']);
  const periodTypeIdx = getColIndex(['period type', 'frequency', 'granularity']);

  for (let i = 1; i < lines.length; i++) {
    try {
      const cells = parseCSVLine(lines[i]);
      if (cells.length < 2) continue;

      const getCell = (idx: number): string | null => {
        return idx !== -1 && cells[idx] ? cells[idx].trim() : null;
      };

      const province = normalizeProvince(getCell(provinceIdx));
      const product = getCell(productIdx);
      const volume = parseNumeric(getCell(volumeIdx));
      const volumeUnit = getCell(volumeUnitIdx) || 'm3';
      const value = parseNumeric(getCell(valueIdx));
      const valueUnit = getCell(valueUnitIdx) || 'CAD';
      const period = getCell(periodIdx);
      const periodType = getCell(periodTypeIdx) || detectPeriodType(period);

      const hashContent = `oil|${province}|${product}|${volume}|${value}|${period}`;
      const id = await computeHash(hashContent, 'sha256');
      if (seenHashes.has(id)) continue;
      seenHashes.add(id);

      records.push({
        id,
        province,
        product,
        volume,
        volumeUnit,
        value,
        valueUnit,
        period: parseDate(period),
        periodType,
        sourceUrl: options.sourceUrl ?? '',
        sourceSystem: 'oil-parser',
        ingestedAt: now,
      });
    } catch (err) {
      console.warn(`[Oil Parser] Skipping CSV row ${i}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Gas Storage/Price Parser                                          */
/* ------------------------------------------------------------------ */

/**
 * Parse gas storage/price CSV data into structured records.
 *
 * Expected CSV columns (varies by dataset):
 *   Province, Facility, StorageVolume, StorageUnit, Price, PriceUnit, Date
 *
 * @param csv - Raw CSV text content
 * @param options - Parsing options
 * @returns Array of GasStorageRecord
 */
export async function parseGasRecord(
  csv: string,
  options: {
    sourceUrl?: string;
    fiscalYear?: string;
  } = {},
): Promise<GasStorageRecord[]> {
  const now = new Date().toISOString();
  const records: GasStorageRecord[] = [];
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

  const provinceIdx = getColIndex(['province', 'prov', 'province/territory', 'jurisdiction']);
  const facilityIdx = getColIndex(['facility', 'site', 'location', 'name']);
  const storageVolumeIdx = getColIndex(['storage volume', 'storage', 'volume', 'inventory']);
  const storageUnitIdx = getColIndex(['storage unit', 'volume unit', 'unit']);
  const priceIdx = getColIndex(['price', 'cost', 'value']);
  const priceUnitIdx = getColIndex(['price unit', 'currency', 'cost unit']);
  const dateIdx = getColIndex(['date', 'period', 'time', 'year']);

  for (let i = 1; i < lines.length; i++) {
    try {
      const cells = parseCSVLine(lines[i]);
      if (cells.length < 2) continue;

      const getCell = (idx: number): string | null => {
        return idx !== -1 && cells[idx] ? cells[idx].trim() : null;
      };

      const province = normalizeProvince(getCell(provinceIdx));
      const facility = getCell(facilityIdx);
      const storageVolume = parseNumeric(getCell(storageVolumeIdx));
      const storageUnit = getCell(storageUnitIdx) || 'm3';
      const price = parseNumeric(getCell(priceIdx));
      const priceUnit = getCell(priceUnitIdx) || 'CAD';
      const date = getCell(dateIdx);

      const hashContent = `gas|${province}|${facility}|${storageVolume}|${price}|${date}`;
      const id = await computeHash(hashContent, 'sha256');
      if (seenHashes.has(id)) continue;
      seenHashes.add(id);

      records.push({
        id,
        province,
        facility,
        storageVolume,
        storageUnit,
        price,
        priceUnit,
        date: parseDate(date),
        sourceUrl: options.sourceUrl ?? '',
        sourceSystem: 'gas-parser',
        ingestedAt: now,
      });
    } catch (err) {
      console.warn(`[Gas Parser] Skipping CSV row ${i}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Electricity Generation Parser                                     */
/* ------------------------------------------------------------------ */

/**
 * Parse electricity generation CSV data into structured records.
 *
 * Expected CSV columns (varies by dataset):
 *   Province, FuelType, GenerationMW, GenerationUnit, Period, PeriodType
 *
 * @param csv - Raw CSV text content
 * @param options - Parsing options
 * @returns Array of ElectricityGenerationRecord
 */
export async function parseElectricityRecord(
  csv: string,
  options: {
    sourceUrl?: string;
    fiscalYear?: string;
  } = {},
): Promise<ElectricityGenerationRecord[]> {
  const now = new Date().toISOString();
  const records: ElectricityGenerationRecord[] = [];
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

  const provinceIdx = getColIndex(['province', 'prov', 'province/territory', 'jurisdiction']);
  const fuelTypeIdx = getColIndex(['fuel type', 'fuel', 'type', 'energy source', 'source']);
  const generationIdx = getColIndex(['generation', 'generationmw', 'generation mw', 'electricity', 'output', 'power']);
  const generationUnitIdx = getColIndex(['generation unit', 'unit', 'mw']);
  const periodIdx = getColIndex(['period', 'date', 'time', 'year']);
  const periodTypeIdx = getColIndex(['period type', 'frequency', 'granularity']);

  for (let i = 1; i < lines.length; i++) {
    try {
      const cells = parseCSVLine(lines[i]);
      if (cells.length < 2) continue;

      const getCell = (idx: number): string | null => {
        return idx !== -1 && cells[idx] ? cells[idx].trim() : null;
      };

      const province = normalizeProvince(getCell(provinceIdx));
      const fuelType = normalizeFuelType(getCell(fuelTypeIdx));
      const generationMW = parseNumeric(getCell(generationIdx));
      const generationUnit = getCell(generationUnitIdx) || 'MW';
      const period = getCell(periodIdx);
      const periodType = getCell(periodTypeIdx) || detectPeriodType(period);

      const hashContent = `electricity|${province}|${fuelType}|${generationMW}|${period}`;
      const id = await computeHash(hashContent, 'sha256');
      if (seenHashes.has(id)) continue;
      seenHashes.add(id);

      records.push({
        id,
        province,
        fuelType,
        generationMW,
        generationUnit,
        period: parseDate(period),
        periodType,
        sourceUrl: options.sourceUrl ?? '',
        sourceSystem: 'electricity-parser',
        ingestedAt: now,
      });
    } catch (err) {
      console.warn(`[Electricity Parser] Skipping CSV row ${i}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Renewable Energy Parser                                           */
/* ------------------------------------------------------------------ */

/**
 * Parse renewable energy capacity CSV data into structured records.
 *
 * Expected CSV columns (varies by dataset):
 *   Province, EnergyType, Capacity, CapacityUnit, Period
 *
 * @param csv - Raw CSV text content
 * @param options - Parsing options
 * @returns Array of RenewableEnergyRecord
 */
export async function parseRenewableRecord(
  csv: string,
  options: {
    sourceUrl?: string;
    fiscalYear?: string;
  } = {},
): Promise<RenewableEnergyRecord[]> {
  const now = new Date().toISOString();
  const records: RenewableEnergyRecord[] = [];
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

  const provinceIdx = getColIndex(['province', 'prov', 'province/territory', 'jurisdiction']);
  const energyTypeIdx = getColIndex(['energy type', 'type', 'technology', 'renewable type']);
  const capacityIdx = getColIndex(['capacity', 'power', 'output', 'generation']);
  const capacityUnitIdx = getColIndex(['capacity unit', 'unit', 'mw', 'kw']);
  const periodIdx = getColIndex(['period', 'date', 'time', 'year']);

  for (let i = 1; i < lines.length; i++) {
    try {
      const cells = parseCSVLine(lines[i]);
      if (cells.length < 2) continue;

      const getCell = (idx: number): string | null => {
        return idx !== -1 && cells[idx] ? cells[idx].trim() : null;
      };

      const province = normalizeProvince(getCell(provinceIdx));
      const energyType = normalizeFuelType(getCell(energyTypeIdx));
      const capacity = parseNumeric(getCell(capacityIdx));
      const capacityUnit = getCell(capacityUnitIdx) || 'MW';
      const period = getCell(periodIdx);

      const hashContent = `renewable|${province}|${energyType}|${capacity}|${period}`;
      const id = await computeHash(hashContent, 'sha256');
      if (seenHashes.has(id)) continue;
      seenHashes.add(id);

      records.push({
        id,
        province,
        energyType,
        capacity,
        capacityUnit,
        period: parseDate(period),
        sourceUrl: options.sourceUrl ?? '',
        sourceSystem: 'renewable-parser',
        ingestedAt: now,
      });
    } catch (err) {
      console.warn(`[Renewable Parser] Skipping CSV row ${i}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Batch Parser                                                       */
/* ------------------------------------------------------------------ */

/**
 * Parse a batch of energy records, auto-detecting the type.
 *
 * @param rawRecords - Array of raw CKAN records or CSV strings
 * @param options - Parsing options
 * @returns Array of EnergyParsedRecord (mixed types)
 */
export async function parseEnergyBatch(
  rawRecords: Array<{ csv?: string; title?: string; type?: string }>,
  options: {
    sourceUrl?: string;
    fiscalYear?: string;
  } = {},
): Promise<EnergyParsedRecord[]> {
  const allRecords: EnergyParsedRecord[] = [];

  for (const raw of rawRecords) {
    if (!raw.csv) continue;

    const title = raw.title ?? '';
    const explicitType = raw.type ?? '';
    const combined = `${title} ${explicitType}`;
    const sector = explicitType || detectEnergySector(combined);

    let records: EnergyParsedRecord[] = [];

    try {
      if (sector === 'oil') {
        records = await parseOilRecord(raw.csv, options);
      } else if (sector === 'gas') {
        records = await parseGasRecord(raw.csv, options);
      } else if (sector === 'electricity') {
        records = await parseElectricityRecord(raw.csv, options);
      } else if (sector === 'renewable') {
        records = await parseRenewableRecord(raw.csv, options);
      } else {
        // Default to electricity parser for unknown types
        records = await parseElectricityRecord(raw.csv, options);
      }

      allRecords.push(...records);
    } catch (err) {
      console.warn(`[Energy Batch Parser] Skipping record: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return allRecords;
}

/* ------------------------------------------------------------------ */
/*  Legacy Compatibility — Parse EnergyRecord from raw data           */
/* ------------------------------------------------------------------ */

/**
 * Parse raw CKAN data into EnergyRecord format (legacy compatibility).
 * This bridges the gap between the simple EnergyRecord type and the new parsed types.
 *
 * @param rawRecords - Array of raw CKAN package records
 * @returns Array of EnergyRecord
 */
export async function parseEnergyRecords(
  rawRecords: Array<{ id: string; title: string; notes?: string; metadata_created?: string }>,
): Promise<EnergyRecord[]> {
  const now = new Date().toISOString();
  const records: EnergyRecord[] = [];
  const seenHashes = new Set<string>();

  for (const raw of rawRecords) {
    try {
      const hashContent = `energy|${raw.id}|${raw.title}`;
      const id = await computeHash(hashContent, 'sha256');
      if (seenHashes.has(id)) continue;
      seenHashes.add(id);

      const sector = detectEnergySector(raw.title + ' ' + (raw.notes ?? ''));
      const description = (raw.notes ?? '').substring(0, 300);
      const date = raw.metadata_created?.substring(0, 10) || '';
      const url = `https://open.canada.ca/data/en/dataset/${raw.id}`;

      records.push({
        id,
        title: raw.title || '',
        description,
        url,
        date,
        sector,
        category: 'energy',
      });
    } catch (err) {
      console.warn(`[Energy Parser] Skipping record ${raw.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return records;
}