/**
 * Indigenous Relations Data Types — Quill
 *
 * Types for tracking Canadian Indigenous relations data:
 *   - CIRNAC land claims (active claims, settled amounts, duration)
 *   - ISC health/education/infrastructure per-community spending
 *   - First Nations financial transparency (chief/council salaries, FNFT Act)
 *   - TRC Calls to Action (progress on each of 94 calls)
 *   - Self-government agreements (active negotiations)
 *
 * Source terms, privacy controls, and Indigenous data governance are
 * dataset-specific. Public availability does not establish reuse permission.
 */

/* ------------------------------------------------------------------ */
/*  CIRNAC — Land Claims (Specific & Comprehensive)                    */
/* ------------------------------------------------------------------ */

export interface LandClaim {
  /** SHA-256 citation hash */
  id: string;

  /** Claim type: specific or comprehensive */
  claimType: 'specific' | 'comprehensive';

  /** Claimant First Nation / community name */
  claimant: string;

  /** Province or territory */
  provinceTerritory: string | null;

  /** Description of the claim */
  description: string | null;

  /** Current status (e.g. "Active", "Settled", "Under Negotiation", "Closed") */
  status: string;

  /** Date the claim was submitted or filed */
  submissionDate: string | null;

  /** Date the claim was settled (if applicable) */
  settlementDate: string | null;

  /** Settlement amount in CAD (if settled) */
  settlementAmountCad: number | null;

  /** Duration in years from submission to settlement */
  durationYears: number | null;

  /** Stage of negotiation or process */
  negotiationStage: string | null;

  /** CKAN dataset UUID */
  ckanDatasetId: string;

  sourceUrl: string;
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  ISC — Health, Education, Infrastructure Spend                      */
/* ------------------------------------------------------------------ */

export interface IscCommunitySpending {
  /** SHA-256 hash */
  id: string;

  /** Fiscal year (e.g. "2023-2024") */
  fiscalYear: string;

  /** First Nation / community name */
  communityName: string;

  /** Province/territory */
  provinceTerritory: string | null;

  /** Spending category: health, education, infrastructure, social, other */
  spendingCategory: string;

  /** Program name */
  programName: string;

  /** Amount allocated in CAD */
  allocatedAmount: number;

  /** Amount spent in CAD (null if not yet reported) */
  spentAmount: number | null;

  /** Number of beneficiaries if available */
  beneficiaries: number | null;

  sourceUrl: string;
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  FN Transparency — Chief & Council Salaries (FNFT Act)             */
/* ------------------------------------------------------------------ */

export interface FnTransparencyRecord {
  /** SHA-256 hash */
  id: string;

  /** First Nation community name */
  communityName: string;

  /** Fiscal year */
  fiscalYear: string;

  /** Position title (e.g. "Chief", "Councillor", "Administrator") */
  positionTitle: string;

  /** Individual name */
  individualName: string;

  /** Total compensation (salary + benefits) in CAD */
  totalCompensation: number;

  /** Base salary in CAD */
  baseSalary: number | null;

  /** Taxable benefits in CAD */
  taxableBenefits: number | null;

  /** Is this an elected official? */
  isElected: boolean;

  sourceUrl: string;
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  TRC — Calls to Action Tracker                                      */
/* ------------------------------------------------------------------ */

export interface TrcCallToAction {
  /** Call number (1-94) */
  id: string;

  /** The call number e.g. 1, 2, ..., 94 */
  callNumber: number;

  /** Category of the call (e.g. "Child Welfare", "Education", "Health", "Justice") */
  category: string;

  /** Sub-category if applicable */
  subCategory: string | null;

  /** Title / short description of the call */
  title: string;

  /** Full text of the call to action */
  callText: string;

  /** Current status: "Complete", "In Progress", "Not Started", "Unknown" */
  status: string;

  /** Assessment date */
  assessmentDate: string;

  /** Responsible government entity */
  responsibleEntity: string | null;

  /** Indigenous Services Canada involvement (Y/N/Partial) */
  iscInvolvement: string | null;

  /** Progress notes */
  progressNotes: string | null;

  sourceUrl: string;
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Self-Government Agreements — Active Negotiations                   */
/* ------------------------------------------------------------------ */

export interface SelfGovernmentAgreement {
  /** SHA-256 hash */
  id: string;

  /** First Nation / Indigenous group name */
  indigenousGroup: string;

  /** Province/territory */
  provinceTerritory: string;

  /** Current stage: "Framework Agreement", "Agreement-in-Principle", "Final Agreement", "Implemented" */
  stage: string;

  /** Type of agreement */
  agreementType: string;

  /** Date of initialling or signing */
  signingDate: string | null;

  /** Date came into effect (if implemented) */
  effectiveDate: string | null;

  /** Key provisions summary */
  keyProvisions: string | null;

  /** Jurisdictional areas covered (e.g. "Education", "Health", "Land Management") */
  jurisdictionAreas: string[];

  /** Is this under CIRNAC? */
  isCirnacLed: boolean;

  sourceUrl: string;
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Result                                                  */
/* ------------------------------------------------------------------ */

export interface IndigenousIngestionResult {
  source: string;
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}

/** D1 database interface for persistence */
export interface D1Database {
  exec(sql: string): Promise<void>;
  prepare(sql: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

export interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(col?: string): Promise<T>;
}

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: Record<string, unknown>;
}
