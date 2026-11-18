// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Field normalization and unit conversion utilities.
 *
 * Normalizes field names across sources (snake_case→camelCase, PascalCase→camelCase)
 * and converts numeric fields between metric and imperial units.
 */

/* ------------------------------------------------------------------ */
/*  Field Name Normalization                                           */
/* ------------------------------------------------------------------ */

const snakeRe = /_([a-z0-9])/g;
const pascalRe = /^[A-Z][a-z]+/;

/** Convert a single field name to camelCase */
export function normalizeFieldName(key: string): string {
  // Already camelCase
  if (/^[a-z][a-zA-Z0-9]*$/.test(key) && !key.includes('_')) return key;

  // PascalCase → camelCase: first letter lowercase
  const decapitalized = key.charAt(0).toLowerCase() + key.slice(1);

  // snake_case → camelCase
  const camel = decapitalized.replace(snakeRe, (_, c) => c.toUpperCase());

  return camel;
}

/** Known field name aliases across sources → canonical camelCase name */
const FIELD_ALIASES: Record<string, string> = {
  communication_date: 'communicationDate',
  CommunicationDate: 'communicationDate',
  lobbying_cost_cad: 'lobbyingCost',
  LobbyingCost: 'lobbyingCost',
  start_date: 'startDate',
  startDate: 'startDate',
  effective_date: 'effectiveDate',
  effectiveDate: 'effectiveDate',
  end_date: 'endDate',
  endDate: 'endDate',
  publication_date: 'publicationDate',
  publicationDate: 'publicationDate',
  retrieved_at: 'retrievedAt',
  source_name: 'sourceName',
  source_url: 'sourceUrl',
  source_type: 'sourceType',
  data_hash: 'dataHash',
  update_frequency: 'updateFrequency',
  citation_text: 'citationText',
  citation_footnote: 'citationFootnote',
  original_format: 'originalFormat',
  organization_name: 'organizationName',
  organizationName: 'organizationName',
  org_name: 'organizationName',
  committee_name: 'committeeName',
  committeeName: 'committeeName',
  meeting_number: 'meetingNumber',
  meetingNumber: 'meetingNumber',
  registry_id: 'registryId',
  registryId: 'registryId',
  registration_id: 'registryId',
  RegistrationId: 'registryId',
  corporation_name: 'corporationName',
  in_house_org: 'inHouseOrganization',
  in_house_organization: 'inHouseOrganization',
  designated_public_office_holder: 'designatedPublicOfficeHolder',
  lobbyists_name: 'lobbyistName',
  lobbyist_name: 'lobbyistName',
  client_name: 'clientName',
  clientName: 'clientName',
  subject_matter: 'subjectMatter',
  subject_matters: 'subjectMatters',
  consultation_date: 'consultationDate',
};

/**
 * Recursively normalize field names in an object or array of objects.
 * Handles nested objects and arrays.
 */
export function normalizeFields<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(normalizeFields) as unknown as T;
  }

  const obj = data as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const normalizedKey = FIELD_ALIASES[key] ?? normalizeFieldName(key);
    // Recursively normalize nested objects/arrays
    if (value !== null && typeof value === 'object') {
      result[normalizedKey] = normalizeFields(value);
    } else {
      result[normalizedKey] = value;
    }
  }

  return result as T;
}

/* ------------------------------------------------------------------ */
/*  Unit Conversion                                                    */
/* ------------------------------------------------------------------ */

/** Fixed exchange rate: 1 CAD = 0.75 USD (approximate, updated periodically) */
const CAD_TO_USD = 0.75;

/** Detect the unit type of a field based on its key name */
type UnitType = 'currency' | 'distance' | 'weight' | 'temperature' | null;

function detectUnit(key: string): UnitType {
  const lower = key.toLowerCase();
  // Currency — check for cost/amount/price/cad/usd patterns
  if (/_cad\b/.test(lower) || /_usd\b/.test(lower)) return 'currency';
  if (/\b(cost|amount|price|fee|budget|spending|salary|grant)\b/.test(lower)) return 'currency';

  // Distance
  if (/\b(distance|km|mile|mi_|_km|_mi)\b/.test(lower)) return 'distance';
  if (/\b(length|width|height|depth|altitude)\b/.test(lower)) return 'distance';

  // Weight
  if (/\b(weight|mass|kg|_kg|_lb|pound)\b/.test(lower)) return 'weight';

  // Temperature
  if (/\b(temp|celsius|c|fahrenheit|_c\b|_f\b)\b/.test(lower)) return 'temperature';

  return null;
}

/** Unit conversion factors */
const CONVERSIONS = {
  distance: { metricToImperial: 0.621371, imperialToMetric: 1.60934, metricSuffix: 'km', imperialSuffix: 'mi' },
  weight: { metricToImperial: 2.20462, imperialToMetric: 0.453592, metricSuffix: 'kg', imperialSuffix: 'lb' },
};

/**
 * Convert a single numeric value between unit systems.
 * Returns the converted value with a note about the original.
 */
export function convertUnit(
  value: number,
  unitType: UnitType,
  target: 'metric' | 'imperial',
  currentSystem?: 'metric' | 'imperial',
): number {
  if (unitType === 'currency') {
    // Currency: assume CAD input, convert to/from USD
    if (target === 'imperial') return Math.round(value * CAD_TO_USD * 100) / 100;
    return Math.round(value / CAD_TO_USD * 100) / 100;
  }

  if (unitType === 'distance' || unitType === 'weight') {
    const conv = CONVERSIONS[unitType];
    const isCurrentlyMetric = currentSystem !== 'imperial';
    if (target === 'imperial' && isCurrentlyMetric) return +(value * conv.metricToImperial).toFixed(2);
    if (target === 'metric' && !isCurrentlyMetric) return +(value * conv.imperialToMetric).toFixed(2);
    return value;
  }

  if (unitType === 'temperature') {
    // Assume input is Celsius if not specified
    const isCurrentlyMetric = currentSystem !== 'imperial';
    if (target === 'imperial' && isCurrentlyMetric) return +(value * 9 / 5 + 32).toFixed(1);
    if (target === 'metric' && !isCurrentlyMetric) return +((value - 32) * 5 / 9).toFixed(1);
    return value;
  }

  return value;
}

/** Numeric field key patterns that indicate the current unit system */
function detectCurrentSystem(key: string): 'metric' | 'imperial' | null {
  const lower = key.toLowerCase();
  if (lower.endsWith('_cad') || lower.endsWith('_km') || lower.endsWith('_kg') || lower.includes('_celsius')) return 'metric';
  if (lower.endsWith('_usd') || lower.endsWith('_mi') || lower.endsWith('_lb') || lower.includes('_fahrenheit')) return 'imperial';
  return null;
}

/**
 * Apply unit conversion to numeric fields in data.
 * Converts based on detected unit type and field naming hints.
 */
export function convertUnits<T>(data: T, target: 'metric' | 'imperial'): T {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object' || target === 'metric') return data;

  if (Array.isArray(data)) {
    return data.map((item) => convertUnits(item, target)) as unknown as T;
  }

  const obj = data as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Recurse into nested objects
    if (value !== null && typeof value === 'object') {
      result[key] = convertUnits(value, target);
      continue;
    }

    // Try to convert numeric values
    if (typeof value === 'number') {
      const unitType = detectUnit(key);
      const currentSystem = detectCurrentSystem(key);
      if (unitType) {
        result[key] = convertUnit(value, unitType, target, currentSystem ?? undefined);
        continue;
      }
    }

    result[key] = value;
  }

  return result as T;
}
