// SPDX-License-Identifier: AGPL-3.0-only
/**
 * GIC Appointment Parser — Quill
 *
 * Parses raw GIC appointment records from GC InfoBase, CKAN CSV,
 * and Canada Gazette HTML into structured GICAppointment objects.
 *
 * Handles:
 *   - Salary range extraction ("$200,000 - $250,000" → min/max)
 *   - Department categorization
 *   - Category assignment (board, tribunal, commission, agency, court)
 *   - SHA-256 content hashing for record identification
 */

import { computeHash } from '../../verification/hashing.js';
import type { GICAppointment, GICCategory, RawGICRecord } from './types.js';
import { HIGH_VALUE_GIC_BODIES } from './types.js';


/**
 * Maps organization name or acronym to GIC category.
 * Heuristic based on body type keywords.
 */
const CATEGORY_KEYWORDS: Array<{ keywords: string[]; category: GICCategory }> = [
  { keywords: ['tribunal', 'tribunal'], category: 'tribunal' },
  { keywords: ['commission', 'commission'], category: 'commission' },
  { keywords: ['board', 'board', 'conseil', 'bureau'], category: 'board' },
  { keywords: ['agency', 'agence', 'authority', 'administration'], category: 'agency' },
  { keywords: ['court', 'cour', 'appeal'], category: 'court' },
  { keywords: ['crown corporation', 'société d\'état'], category: 'crown-corporation' },
];

/**
 * Known body names mapped directly to categories.
 * Used for organizations that don't have obvious keywords.
 */
const KNOWN_BODY_CATEGORIES: Record<string, GICCategory> = {
  'canadian radio-television and telecommunications commission': 'commission',
  'crtc': 'commission',
  'canada energy regulator': 'agency',
  'competition tribunal': 'tribunal',
  'canadian international trade tribunal': 'tribunal',
  'federal court of appeal': 'court',
  'federal court': 'court',
  'tax court of canada': 'court',
  'supreme court of canada': 'court',
  'immigration and refugee board': 'tribunal',
  'immigration and refugee board of canada': 'tribunal',
  'canadian human rights tribunal': 'tribunal',
  'canadian transportation agency': 'agency',
  'canada industrial relations board': 'board',
  'impact assessment agency of canada': 'agency',
  'canadian human rights commission': 'commission',
  'office of the superintendent of financial institutions': 'agency',
  'canada deposit insurance corporation': 'crown-corporation',
  'bank of canada': 'crown-corporation',
};


/**
 * Categorize a GIC body by its name/acronym.
 */
export function categorizeByBody(
  organization: string,
  acronym: string | null,
): GICCategory {
  const search = (organization + ' ' + (acronym ?? '')).toLowerCase().trim();

  // Check known bodies first
  for (const [name, category] of Object.entries(KNOWN_BODY_CATEGORIES)) {
    if (search.includes(name)) {
      return category;
    }
  }

  // Check high-value bodies list
  for (const body of HIGH_VALUE_GIC_BODIES) {
    if (
      search.includes(body.name.toLowerCase()) ||
      (body.acronym && search.includes(body.acronym.toLowerCase()))
    ) {
      return body.category as GICCategory;
    }
  }

  // Heuristic keyword matching
  for (const rule of CATEGORY_KEYWORDS) {
    for (const kw of rule.keywords) {
      if (search.includes(kw)) {
        return rule.category;
      }
    }
  }

  return 'other';
}

/**
 * Categorize an appointment by department.
 * Maps department names to standardized categories.
 */
export function categorizeByDepartment(
  appointment: GICAppointment,
): string {
  const dept = (appointment.department ?? '').toLowerCase();

  if (dept.includes('heritage') || dept.includes('patrimoine')) return 'culture-heritage';
  if (dept.includes('natural resources') || dept.includes('ressources naturelles')) return 'resources-energy';
  if (dept.includes('innovation') || dept.includes('industry') || dept.includes('industrie')) return 'industry-technology';
  if (dept.includes('finance')) return 'finance-economy';
  if (dept.includes('justice')) return 'justice-courts';
  if (dept.includes('transport')) return 'transport-infrastructure';
  if (dept.includes('environment') || dept.includes('climate')) return 'environment-climate';
  if (dept.includes('employment') || dept.includes('social') || dept.includes('labour')) return 'labour-employment';
  if (dept.includes('public safety') || dept.includes('sécurité publique')) return 'public-safety';
  if (dept.includes('immigration') || dept.includes('refugee') || dept.includes('citoyenneté')) return 'immigration-citizenship';
  if (dept.includes('indigenous') || dept.includes('crown-indigenous') || dept.includes('autochtones')) return 'indigenous';
  if (dept.includes('health') || dept.includes('santé')) return 'health';
  if (dept.includes('defence') || dept.includes('défense')) return 'defence';
  if (dept.includes('foreign') || dept.includes('global affairs') || dept.includes('affaires étrangères')) return 'foreign-affairs';
  if (dept.includes('agriculture') || dept.includes('agri-food')) return 'agriculture-food';
  if (dept.includes('fisheries') || dept.includes('oceans')) return 'fisheries-oceans';

  return 'other';
}


/**
 * Extract salary range from a text string.
 *
 * Handles formats:
 *   - "$200,000 - $250,000"
 *   - "$200,000 to $250,000"
 *   - "$200,000"
 *   - "$200K - $250K"
 *   - "200,000 - 250,000"
 *   - "$1,200 - $1,500 (per diem)"
 */
export function extractSalaryRange(
  text: string | null | undefined,
): { range: string | null; min: number | null; max: number | null } {
  if (!text || text.trim().length === 0) {
    return { range: null, min: null, max: null };
  }

  const trimmed = text.trim();

  // Pattern 1: "$X,XXX - $Y,YYY" or "$X,XXX to $Y,YYY"
  const rangeMatch = trimmed.match(
    /\$?\s*([\d,]+(?:\.\d{2})?)\s*(?:-|–|to)\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
  );

  if (rangeMatch) {
    const min = parseSalaryNumber(rangeMatch[1]);
    const max = parseSalaryNumber(rangeMatch[2]);
    return { range: trimmed, min, max };
  }

  // Pattern 2: Single value "$X,XXX"
  const singleMatch = trimmed.match(/\$?\s*([\d,]+(?:\.\d{2})?)/);
  if (singleMatch) {
    const value = parseSalaryNumber(singleMatch[1]);
    return { range: trimmed, min: value, max: value };
  }

  // Pattern 3: "$XK - $YK"
  const kRangeMatch = trimmed.match(/\$?\s*(\d+)K?\s*(?:-|–|to)\s*\$?\s*(\d+)K?/i);
  if (kRangeMatch) {
    const min = parseInt(kRangeMatch[1], 10) * 1000;
    const max = parseInt(kRangeMatch[2], 10) * 1000;
    return { range: trimmed, min, max };
  }

  return { range: trimmed, min: null, max: null };
}

/**
 * Parse a salary number string, handling commas and decimals.
 * "200,000" → 200000, "250,000.00" → 250000
 */
function parseSalaryNumber(str: string): number {
  const cleaned = str.replace(/[,$\s]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
}


/**
 * Parse a raw GIC appointment record into a structured GICAppointment.
 * The raw record can come from GC InfoBase API, CKAN CSV, or web scraping.
 */
/**
 * Safely access string field from RawGICRecord (handles `unknown` index type).
 */
function str(raw: RawGICRecord, ...keys: string[]): string {
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return '';
}

export async function parseGICAppointment(
  raw: RawGICRecord,
  options: {
    /** Override the source system */
    sourceSystem?: string;
    /** Override the CKAN package ID */
    ckanPackageId?: string;
    /** Override the CKAN resource ID */
    ckanResourceId?: string;
  } = {},
): Promise<GICAppointment | null> {
  // Extract base fields
  const appointeeName = str(raw, 'appointeeName', 'appointee_name', 'name');
  const positionTitle = str(raw, 'positionTitle', 'position_title', 'position', 'title');
  const organization = str(raw, 'organization', 'organization_name', 'body', 'institution');
  const department = str(raw, 'department', 'department_name', 'ministry');
  const appointmentDate = str(raw, 'appointmentDate', 'appointment_date', 'date', 'start_date');
  const expiryDate = str(raw, 'expiryDate', 'expiry_date', 'expiration', 'end_date') || null;
  const salaryRaw = str(raw, 'salaryRange', 'salary_range', 'salary', 'compensation') || null;

  // Skip empty records
  if (!appointeeName && !positionTitle) {
    return null;
  }

  // Parse salary
  const salary = extractSalaryRange(salaryRaw);

  // Derive category
  const acronym = str(raw, 'organizationAcronym', 'organization_acronym', 'acronym') || null;
  const rawCat = str(raw, 'category');
  const category: GICCategory = rawCat
    ? (rawCat as GICCategory)
    : categorizeByBody(organization, acronym);

  // Determine if retroactive
  const retroStr = str(raw, 'isRetroactive', 'is_retroactive');
  const isRetroactive = retroStr === 'true' || retroStr === 'yes' || retroStr === '1';

  // Build the record string for hashing
  const sourceSystem = (options.sourceSystem ?? str(raw, 'sourceSystem', 'source_system')) || 'gic-module';
  const recordForHash = JSON.stringify({
    appointeeName,
    positionTitle,
    organization,
    appointmentDate,
    expiryDate,
    department,
    sourceSystem,
  });

  const location = str(raw, 'location', 'location_name') || null;
  const predecessorName = str(raw, 'predecessorName', 'predecessor_name', 'predecessor') || null;
  const orderInCouncilNumber = str(raw, 'orderInCouncilNumber', 'order_in_council_number', 'pc_number', 'order_number') || null;
  const sourceUrl = str(raw, 'sourceUrl', 'source_url', 'url');
  const ckanPackageId = (options.ckanPackageId ?? str(raw, 'ckanPackageId', 'ckan_package_id')) || null;
  const ckanResourceId = (options.ckanResourceId ?? str(raw, 'ckanResourceId', 'ckan_resource_id')) || null;

  const appointment: GICAppointment = {
    id: await computeHash(recordForHash, 'sha256'),

    appointeeName,
    positionTitle,
    organization,
    organizationAcronym: acronym,
    category,
    department,

    appointmentDate,
    expiryDate,

    isRetroactive,

    salaryRange: salary.range,
    salaryMin: salary.min,
    salaryMax: salary.max,

    location,
    predecessorName,
    orderInCouncilNumber,

    sourceUrl,
    sourceSystem,
    ckanPackageId,
    ckanResourceId,

    ingestedAt: new Date().toISOString(),
  };

  return appointment;
}

/**
 * Parse a batch of raw GIC records into structured appointments.
 * Filters out null (invalid) records.
 */
export async function parseGICAppointments(
  rawRecords: RawGICRecord[],
  options: {
    sourceSystem?: string;
  } = {},
): Promise<GICAppointment[]> {
  const results: GICAppointment[] = [];

  for (const raw of rawRecords) {
    const parsed = await parseGICAppointment(raw, options);
    if (parsed !== null) {
      results.push(parsed);
    }
  }

  return results;
}

/**
 * Extract department category from appointment.
 * For easy sorting/filtering by policy area.
 */
export function extractDepartmentCategory(
  department: string,
): string {
  return categorizeByDepartment({
    id: '',
    appointeeName: '',
    positionTitle: '',
    organization: '',
    organizationAcronym: null,
    category: 'other',
    department,
    appointmentDate: '',
    expiryDate: null,
    isRetroactive: false,
    salaryRange: null,
    salaryMin: null,
    salaryMax: null,
    location: null,
    predecessorName: null,
    orderInCouncilNumber: null,
    sourceUrl: '',
    sourceSystem: '',
    ckanPackageId: null,
    ckanResourceId: null,
    ingestedAt: '',
  });
}
