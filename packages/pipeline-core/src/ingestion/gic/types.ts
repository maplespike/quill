/**
 * GIC Appointment Types — Quill
 *
 * Strongly-typed interfaces for Governor-in-Council (GIC) federal appointments
 * to boards, tribunals, commissions, agencies, and courts across the
 * Government of Canada. These ~1,500+ positions represent the patronage
 * pipeline — the political appointment system for key regulatory and
 * adjudicative bodies.
 *
 * Sources:
 *   - GC InfoBase: https://www.infobasegc.ca/
 *   - Canada Gazette Orders in Council (open.canada.ca CKAN)
 *   - PCO GIC Appointments portal: https://www.canada.ca/en/privy-council/services/governor-council-appointments.html
 */


export type GICCategory =
  | 'board'
  | 'tribunal'
  | 'commission'
  | 'committee'
  | 'agency'
  | 'court'
  | 'crown-corporation'
  | 'other';


export interface GICAppointment {
  /** SHA-256 citation hash (primary key) */
  id: string;

  /** Full name of the appointee */
  appointeeName: string;

  /** Position title (e.g. "Chairperson", "Commissioner", "Member") */
  positionTitle: string;

  /** The board, tribunal, commission, agency, or court name */
  organization: string;

  /** Organization acronym (e.g. "CRTC", "CER", "CITT") */
  organizationAcronym: string | null;

  /** Classification of the appointing body */
  category: GICCategory;

  /** Appointing department / ministry */
  department: string;

  /** Date of the Order in Council appointment (ISO-8601) */
  appointmentDate: string;

  /** Date the appointment expires (ISO-8601) */
  expiryDate: string | null;

  /** Whether the appointment is retroactive */
  isRetroactive: boolean;

  /** Salary range as published (e.g. "$200,000 - $250,000") */
  salaryRange: string | null;

  /** Minimum salary value (parsed numeric) */
  salaryMin: number | null;

  /** Maximum salary value (parsed numeric) */
  salaryMax: number | null;

  /** Location of the position (city, province) */
  location: string | null;

  /** Preceding / replacing appointee name (if applicable) */
  predecessorName: string | null;

  /** Order in Council number (e.g. "PC-2025-0001") */
  orderInCouncilNumber: string | null;

  /** Source URL where this record was found */
  sourceUrl: string;

  /** Raw source system (e.g. "infobase", "canada-gazette", "ckan") */
  sourceSystem: string;

  /** CKAN package ID if sourced from open.canada.ca */
  ckanPackageId: string | null;

  /** CKAN resource ID if sourced from a specific resource */
  ckanResourceId: string | null;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}


/**
 * High-value GIC bodies warranting special tracking.
 * These include regulatory bodies, courts, and tribunals
 * whose appointments have significant policy and economic impact.
 */
export const HIGH_VALUE_GIC_BODIES: Array<{
  name: string;
  acronym: string;
  category: GICCategory;
  department: string;
}> = [
  // Telecom & Broadcasting
  { name: 'Canadian Radio-television and Telecommunications Commission', acronym: 'CRTC', category: 'commission', department: 'Canadian Heritage' },
  { name: 'Canadian Radio-television and Telecommunications Commission (Broadcasting)', acronym: 'CRTC-B', category: 'commission', department: 'Canadian Heritage' },

  // Energy
  { name: 'Canada Energy Regulator', acronym: 'CER', category: 'agency', department: 'Natural Resources' },
  { name: 'Canada Energy Regulator Board', acronym: 'CER-B', category: 'board', department: 'Natural Resources' },

  // Competition & Trade
  { name: 'Competition Tribunal', acronym: 'CT', category: 'tribunal', department: 'Innovation, Science and Industry' },
  { name: 'Canadian International Trade Tribunal', acronym: 'CITT', category: 'tribunal', department: 'Finance' },

  // Courts
  { name: 'Federal Court of Appeal', acronym: 'FCA', category: 'court', department: 'Justice' },
  { name: 'Federal Court', acronym: 'FC', category: 'court', department: 'Justice' },
  { name: 'Tax Court of Canada', acronym: 'TCC', category: 'court', department: 'Justice' },
  { name: 'Supreme Court of Canada', acronym: 'SCC', category: 'court', department: 'Justice' },

  // Financial & Economic
  { name: 'Bank of Canada Board of Directors', acronym: 'BOC-B', category: 'board', department: 'Finance' },
  { name: 'Canada Deposit Insurance Corporation Board', acronym: 'CDIC-B', category: 'board', department: 'Finance' },
  { name: 'Office of the Superintendent of Financial Institutions Board', acronym: 'OSFI-B', category: 'board', department: 'Finance' },

  // Transportation
  { name: 'Canadian Transportation Agency', acronym: 'CTA', category: 'agency', department: 'Transport' },
  { name: 'Canada Port Authorities (Various)', acronym: 'CPA', category: 'board', department: 'Transport' },

  // Environment
  { name: 'Impact Assessment Agency of Canada', acronym: 'IAAC', category: 'agency', department: 'Environment and Climate Change' },

  // Labour & Employment
  { name: 'Canada Industrial Relations Board', acronym: 'CIRB', category: 'board', department: 'Employment and Social Development' },
  { name: 'Canadian Human Rights Tribunal', acronym: 'CHRT', category: 'tribunal', department: 'Justice' },

  // Security & Intelligence
  { name: 'National Security and Intelligence Review Agency', acronym: 'NSIRA', category: 'agency', department: 'Public Safety' },
  { name: 'Security Intelligence Review Committee', acronym: 'SIRC', category: 'committee', department: 'Public Safety' },

  // Immigration & Refugee
  { name: 'Immigration and Refugee Board of Canada', acronym: 'IRB', category: 'tribunal', department: 'Immigration, Refugees and Citizenship' },

  // Indigenous
  { name: 'Specific Claims Tribunal', acronym: 'SCT', category: 'tribunal', department: 'Crown-Indigenous Relations' },
];


export interface GICIngestionResult {
  source: string;
  recordsFound: number;
  recordsIngested: number;
  categoriesFound: Record<GICCategory, number>;
  highValueAppointments: number;
  errors: string[];
  durationMs: number;
}


/**
 * Shape of a raw record from GC InfoBase or CKAN CSV data.
 */
export interface RawGICRecord {
  /** Appointee full name */
  appointeeName?: string;
  /** Position title */
  positionTitle?: string;
  /** Organization / body name */
  organization?: string;
  /** Organization acronym */
  organizationAcronym?: string;
  /** Department name */
  department?: string;
  /** Appointment date */
  appointmentDate?: string;
  /** Expiry date */
  expiryDate?: string;
  /** Salary range text */
  salaryRange?: string;
  /** Location */
  location?: string;
  /** Order in Council number */
  orderInCouncilNumber?: string;
  /** Predecessor name */
  predecessorName?: string;
  /** Whether appointment is retroactive */
  isRetroactive?: string;

  /** Catch-all for any other fields from the source */
  [key: string]: unknown;
}
