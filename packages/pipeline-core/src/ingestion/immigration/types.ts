/**
 * Immigration Data Types — Quill
 *
 * Types for Canadian immigration, refugee, and border data:
 *   - IRCC permanent resident admissions (by category, province, country)
 *   - IRCC temporary residents (study permits, work permits, TRVs)
 *   - IRB refugee protection division decisions
 *   - CBSA enforcement actions
 *
 * Source terms vary by publisher and dataset; public access does not establish reuse permission.
 */

/* ------------------------------------------------------------------ */
/*  IRCC — Permanent Residents                                        */
/* ------------------------------------------------------------------ */

export interface PermanentResidentAdmission {
  /** SHA-256 citation hash */
  id: string;

  /** Immigration category (e.g. "Economic", "Family", "Refugee") */
  immigrationCategory: string;

  /** Sub-category (e.g. "Express Entry", "PNP", "Spouse") */
  subCategory: string | null;

  /** Province or territory of destination */
  provinceTerritory: string | null;

  /** Country of citizenship */
  countryOfCitizenship: string | null;

  /** Year of admission */
  year: number;

  /** Month of admission (1-12, or null for annual) */
  month: number | null;

  /** Number of admissions */
  count: number;

  /** Gender breakdown if available */
  gender: string | null;

  /** Age range if available */
  ageRange: string | null;

  /** Source URL (CKAN or direct) */
  sourceUrl: string;

  /** CKAN dataset UUID */
  ckanDatasetId: string;

  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  IRCC — Temporary Residents (Study Permits, Work Permits, TRVs)    */
/* ------------------------------------------------------------------ */

export interface StudyPermitHolder {
  id: string;
  /** Calendar year */
  year: number;
  /** Quarter (1-4) */
  quarter: number | null;
  /** Country of citizenship */
  countryOfCitizenship: string | null;
  /** Province/territory of destination */
  provinceTerritory: string | null;
  /** Designated learning institution if available */
  institution: string | null;
  /** Level of study (e.g. "University", "College") */
  studyLevel: string | null;
  /** Number of permit holders */
  count: number;
  sourceUrl: string;
  ingestedAt: string;
}

export interface WorkPermitHolder {
  id: string;
  year: number;
  quarter: number | null;
  /** Program type: TFWP or IMP (International Mobility) */
  programType: 'TFWP' | 'IMP';
  /** NOC skill level (0, 1, 2, 3, 4, 5) */
  nocLevel: string | null;
  /** Country of citizenship */
  countryOfCitizenship: string | null;
  /** Province/territory */
  provinceTerritory: string | null;
  /** Number of permit holders */
  count: number;
  sourceUrl: string;
  ingestedAt: string;
}

export interface TemporaryResidentVisa {
  id: string;
  year: number;
  quarter: number | null;
  /** Visa category (e.g. "Visitor", "Transit") */
  visaCategory: string;
  /** Country of citizenship */
  countryOfCitizenship: string | null;
  /** Visa office location */
  visaOffice: string | null;
  /** Applications received */
  applicationsReceived: number | null;
  /** Applications approved */
  applicationsApproved: number | null;
  /** Approval rate */
  approvalRate: number | null;
  sourceUrl: string;
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  IRCC — Citizenship                                                 */
/* ------------------------------------------------------------------ */

export interface CitizenshipGrant {
  id: string;
  year: number;
  quarter: number | null;
  /** Country of former citizenship */
  countryOfCitizenship: string | null;
  /** Province/territory */
  provinceTerritory: string | null;
  /** Citizenship grants */
  grants: number;
  /** Ceremonies held */
  ceremonies: number | null;
  /** Average processing time (days) */
  processingTimeDays: number | null;
  sourceUrl: string;
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  IRB — Refugee Protection Division Decisions                        */
/* ------------------------------------------------------------------ */

export interface RefugeeDecision {
  id: string;
  /** Decision ID (if available) */
  decisionId: string | null;
  /** Year of decision */
  year: number;
  /** Quarter (1-4) */
  quarter: number | null;
  /** Country of origin of the claimant */
  countryOfOrigin: string | null;
  /** Language of proceedings */
  language: string | null;
  /** Decision outcome */
  outcome: 'accepted' | 'rejected' | 'abandoned' | 'withdrawn' | 'other';
  /** Represented by counsel */
  represented: boolean | null;
  /** Gender of claimant */
  gender: string | null;
  /** Claimant age group */
  ageGroup: string | null;
  /** Hearing type */
  hearingType: string | null;
  sourceUrl: string;
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  CBSA — Enforcement Data                                            */
/* ------------------------------------------------------------------ */

export interface CbsaEnforcement {
  id: string;
  /** Fiscal year */
  fiscalYear: string;
  /** Type of enforcement action */
  actionType: string;
  /** Number of actions */
  count: number;
  /** Description */
  description: string | null;
  sourceUrl: string;
  ingestedAt: string;
}

export interface CbsaPenalty {
  id: string;
  /** Penalty year */
  year: number;
  /** Violation type */
  violationType: string;
  /** Penalty amount (CAD) */
  penaltyAmount: number;
  /** Number of penalties */
  count: number;
  sourceUrl: string;
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Cross-Reference — Executive link to lobbying                       */
/* ------------------------------------------------------------------ */

export interface ImmigrationLobbyingLink {
  irccOfficial: string;
  title: string;
  lobbyingRecords: {
    registrantName: string;
    clientName: string;
    subjectMatter: string[];
    communicationDate: string;
  }[];
}

/* ------------------------------------------------------------------ */
/*  Ingestion Result                                                  */
/* ------------------------------------------------------------------ */

export interface ImmigrationIngestionResult {
  source: string;
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
