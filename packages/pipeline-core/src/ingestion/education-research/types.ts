/**
 * Education & Research Data Types — MapleSpike Pipeline
 *
 * Types for Canadian education and research source data:
 *   - Tri-Council grants (CIHR/NSERC/SSHRC) — federal research funding
 *   - Canada Research Chairs (CRC) — top-tier academic chairs
 *   - Canada Foundation for Innovation (CFI) — research infrastructure
 *   - Canada Student Loans (CSL) — default rates, debt, repayment
 *
 * Sources include open.canada.ca and publisher sites. Access does not establish
 * reuse permission; apply dataset-specific terms and restrictions.
 * HTML sources: Digital Research Alliance (alliancecan.ca), Mitacs (mitacs.ca).
 */

/* ------------------------------------------------------------------ */
/*  Tri-Council Grants — CIHR / NSERC / SSHRC                         */
/* ------------------------------------------------------------------ */

/** Grant-awarding agency */
export type TriCouncilAgency = 'CIHR' | 'NSERC' | 'SSHRC';

export interface TriCouncilGrant {
  /** SHA-256 citation hash */
  id: string;

  /** Granting agency */
  agency: TriCouncilAgency;

  /** Program name (e.g. "Project Grant", "Discovery Grant", "Insight Grant") */
  programName: string;

  /** Fiscal year of the award (e.g. "2023-2024") */
  fiscalYear: string;

  /** Recipient name (PI / applicant) */
  recipientName: string;

  /** Recipient's institution */
  recipientInstitution: string;

  /** Awarded grant amount in CAD */
  grantAmount: number;

  /** Currency (always CAD for these programs) */
  currency: string;

  /** Project title */
  projectTitle: string;

  /** Project summary / abstract */
  projectSummary: string | null;

  /** Source CKAN dataset URL */
  sourceUrl: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Canada Research Chairs                                             */
/* ------------------------------------------------------------------ */

export interface ResearchChair {
  /** SHA-256 citation hash */
  id: string;

  /** Chairholder's full name */
  chairholderName: string;

  /** Institution where the chair is held */
  institution: string;

  /** Tier: Tier 1 (senior, 7yr) or Tier 2 (emerging, 5yr) */
  tier: 'Tier 1' | 'Tier 2';

  /** Research discipline / field */
  discipline: string;

  /** Specific CRC program (e.g. "Canada Research Chairs", "CRC") */
  program: string | null;

  /** Start date of the chair */
  startDate: string | null;

  /** Award / announcement date */
  awardDate: string | null;

  /** Source CKAN dataset URL */
  sourceUrl: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Canada Foundation for Innovation — Research Infrastructure         */
/* ------------------------------------------------------------------ */

export interface CFIInfrastructure {
  /** SHA-256 citation hash */
  id: string;

  /** Institution receiving the award */
  institution: string;

  /** Project title */
  projectTitle: string;

  /** CFI program name (e.g. "Innovation Fund", "John R. Evans Leaders Fund") */
  programName: string;

  /** Funding amount awarded in CAD */
  fundingAmount: number;

  /** Currency (always CAD) */
  currency: string;

  /** Infrastructure sector / research area */
  infrastructureSector: string | null;

  /** Province of the awarding institution */
  province: string | null;

  /** Award date */
  awardDate: string | null;

  /** Source CKAN dataset URL */
  sourceUrl: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Canada Student Loans — Default Rates, Debt, Repayment              */
/* ------------------------------------------------------------------ */

export interface StudentLoan {
  /** SHA-256 citation hash */
  id: string;

  /** Post-secondary institution name */
  institution: string;

  /** Province of the institution */
  province: string;

  /** Program / academic year (e.g. "2021-2022") */
  programYear: string;

  /** Student loan default rate (percentage) */
  defaultRate: number | null;

  /** Number of borrowers in the cohort */
  borrowersCount: number | null;

  /** Total outstanding debt for the cohort */
  totalDebt: number | null;

  /** Average debt per borrower */
  averageDebt: number | null;

  /** Repayment rate (percentage of borrowers repaying) */
  repaymentRate: number | null;

  /** Type of data record */
  dataType: 'default-rate' | 'debt' | 'repayment' | 'other';

  /** Source CKAN dataset URL */
  sourceUrl: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  University Tuition & Fees                                          */
/* ------------------------------------------------------------------ */

export interface UniversityTuition {
  /** SHA-256 citation hash */
  id: string;

  /** University name */
  institution: string;

  /** Province */
  province: string;

  /** Academic year (e.g. "2024-2025") */
  academicYear: string;

  /** Level of study (undergraduate, graduate) */
  studyLevel: string;

  /** Field of study / program */
  program: string;

  /** Tuition fee amount in CAD */
  tuitionFee: number;

  /** Additional compulsory fees */
  additionalFees: number | null;

  /** Total fee (tuition + additional) */
  totalFee: number | null;

  /** Canadian / international student indicator */
  studentCategory: 'canadian' | 'international' | 'both';

  /** Source CKAN dataset URL */
  sourceUrl: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Apprenticeship Registration & Completion                           */
/* ------------------------------------------------------------------ */

export interface ApprenticeshipRecord {
  /** SHA-256 citation hash */
  id: string;

  /** Fiscal year */
  fiscalYear: string;

  /** Province / territory */
  province: string | null;

  /** Trade group / designation */
  tradeGroup: string;

  /** Specific trade name */
  tradeName: string;

  /** Number of new registrations */
  registrations: number | null;

  /** Number of completed certifications */
  completions: number | null;

  /** Number of active apprentices */
  activeApprentices: number | null;

  /** Source CKAN dataset URL */
  sourceUrl: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Aggregated Results                                                 */
/* ------------------------------------------------------------------ */

export interface EduIngestionResult {
  source: string;
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
  /** Parsed records returned when db is null (dry-run mode) */
  records?: unknown[];
}
