/**
 * LMIA Data Types — Quill
 *
 * Strongly-typed interfaces for Labour Market Impact Assessment (LMIA)
 * data published by Employment and Social Development Canada (ESDC)
 * on open.canada.ca.
 *
 * Sources:
 *   - Positive LMIA:  CKAN Package 90fed587-1364-4f33-a9ee-208181dc0b97
 *   - Negative LMIA:  CKAN Package f82f66f2-a22b-4511-bccf-e1d74db39ae5
 *
 * Data published quarterly as CSV files since 2014.
 * Latest available: 2025Q4
 */


export enum LmiaOutcome {
  Positive = 'positive',
  Negative = 'negative',
}


/**
 * The LMIA stream/category as defined by ESDC.
 *
 * Streams determine the requirements and processing times:
 *   - Agricultural: Seasonal Agricultural Worker Program and other ag streams
 *   - High-Wage: Wages at or above the provincial median
 *   - Low-Wage: Wages below the provincial median
 *   - Global Talent: Global Talent Stream (high-skilled tech)
 *   - Permanent Residence: LMIA-based PR streams
 *   - Primary Agriculture: General agricultural workers
 *   - Academic: Faculty and academic staff
 *   - In-Home Caregiver: Caregiver stream
 *   - Other: Fallback for unrecognized streams
 */
export enum LmiaStream {
  Agricultural = 'agricultural',
  HighWage = 'high-wage',
  LowWage = 'low-wage',
  GlobalTalent = 'global-talent',
  PermanentResidence = 'permanent-residence',
  PrimaryAgriculture = 'primary-agriculture',
  Academic = 'academic',
  InHomeCaregiver = 'in-home-caregiver',
  Other = 'other',
}


export interface LmiaRecord {
  /** SHA-256 hash of the row content (primary key) */
  id: string;

  /** Employer/company name */
  employer: string;

  /** City where the work is located */
  city: string | null;

  /** Province/territory where the work is located (2-letter code) */
  province: string | null;

  /** LMIA outcome: positive or negative */
  outcome: LmiaOutcome;

  /** LMIA stream category */
  stream: LmiaStream;

  /** Original stream description from the CSV */
  streamRaw: string;

  /** National Occupational Classification (NOC) code (2021 version) */
  noc: string | null;

  /** NOC job title/description */
  nocTitle: string | null;

  /** Number of positions approved/assessed */
  positions: number | null;

  /** Minimum wage offered ($/hour) */
  wageMin: number | null;

  /** Maximum wage offered ($/hour) */
  wageMax: number | null;

  /** Wage rate period (hourly, weekly, annually) */
  wageRate: string | null;

  /** Quarter of the data (e.g. "2025Q4") */
  quarter: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}


export interface LmiaIngestionResult {
  outcome: LmiaOutcome;
  quarter: string;
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
