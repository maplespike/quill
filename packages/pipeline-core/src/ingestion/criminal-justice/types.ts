/**
 * Criminal Justice Data Types — Quill
 *
 * Types for Canadian criminal justice data covering:
 *   - CSC prison population, incidents, deaths, costs
 *   - Parole Board of Canada decisions by offence and region
 *   - RCMP crime statistics (hate crimes, organized crime, by jurisdiction)
 *   - PPSC federal prosecution caseloads, outcomes, stay rates
 *   - Youth criminal justice (diversion, custody, recidivism)
 *   - Legal aid funding (per-province, per-case costs)
 *
 * Sources include open.canada.ca CKAN, Statistics Canada, and departmental
 * portals. Terms and restrictions must be checked for each dataset.
 */

/* ------------------------------------------------------------------ */
/*  CSC — Correctional Service Canada                                  */
/* ------------------------------------------------------------------ */

export interface CscPopulation {
  /** SHA-256 citation hash */
  id: string;

  /** Fiscal year (e.g. "2022-2023") */
  fiscalYear: string;

  /** Institution name or "Total Federal" */
  institution: string;

  /** Region (Atlantic, Quebec, Ontario, Prairies, Pacific, NHQ) */
  region: string;

  /** Population count */
  count: number;

  /** Type of population (e.g. "In Custody", "Community Supervision", "Total") */
  populationType: string;

  /** Gender ("Male", "Female", "Total") */
  gender: string;

  /** Security level (Maximum, Medium, Minimum, Multi-level, Community) */
  securityLevel: string | null;

  sourceUrl: string;

  ingestedAt: string;
}

export interface CscIncident {
  id: string;

  /** Fiscal year */
  fiscalYear: string;

  /** Institution */
  institution: string;

  /** Region */
  region: string;

  /** Incident type (e.g. "Assault", "Death", "Escape", "Drug Seizure") */
  incidentType: string;

  /** Number of incidents */
  count: number;

  sourceUrl: string;

  ingestedAt: string;
}

export interface CscDeathInCustody {
  id: string;

  /** Fiscal year of death */
  fiscalYear: string;

  /** Cause of death (e.g. "Natural", "Suicide", "Homicide", "Accidental", "Unknown") */
  causeOfDeath: string;

  /** Gender */
  gender: string;

  /** Age range */
  ageRange: string | null;

  /** Ethnicity if available */
  ethnicity: string | null;

  /** Count */
  count: number;

  sourceUrl: string;

  ingestedAt: string;
}

export interface CscCostPerInmate {
  id: string;

  /** Fiscal year */
  fiscalYear: string;

  /** Institution type (e.g. "Maximum", "Medium", "Minimum", "Multi-level", "Community") */
  institutionType: string;

  /** Average annual cost per inmate (CAD) */
  costPerInmate: number;

  sourceUrl: string;

  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Parole Board of Canada — Decisions                                 */
/* ------------------------------------------------------------------ */

export interface ParoleDecision {
  id: string;

  /** Fiscal year */
  fiscalYear: string;

  /** Type of parole (Day Parole, Full Parole, Escorted TLO, Unescorted TLO) */
  paroleType: string;

  /** Offence category (e.g. "Homicide", "Sexual Offences", "Robbery", "Drugs") */
  offenceCategory: string;

  /** Region */
  region: string;

  /** Number of decisions */
  totalDecisions: number;

  /** Number granted */
  granted: number;

  /** Number denied */
  denied: number;

  /** Grant rate (0-100%) */
  grantRate: number | null;

  sourceUrl: string;

  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  RCMP — Crime Statistics                                            */
/* ------------------------------------------------------------------ */

export interface RcmpHateCrime {
  id: string;

  /** Year */
  year: number;

  /** Jurisdiction (Canada, province, territory, city) */
  jurisdiction: string;

  /** Motivation type (e.g. "Race/Ethnicity", "Religion", "Sexual Orientation") */
  motivationType: string;

  /** Number of incidents */
  incidents: number;

  /** Clearance status (solved %) */
  clearanceRate: number | null;

  sourceUrl: string;

  ingestedAt: string;
}

export interface RcmpOrganizedCrime {
  id: string;

  /** Year */
  year: number;

  /** Jurisdiction */
  jurisdiction: string;

  /** Organized crime type (e.g. "Drug Trafficking", "Human Trafficking", "Fraud") */
  crimeType: string;

  /** Number of incidents */
  incidents: number;

  sourceUrl: string;

  ingestedAt: string;
}

export interface RcmpCrimeSeverity {
  id: string;

  /** Year */
  year: number;

  /** Jurisdiction */
  jurisdiction: string;

  /** Crime Severity Index value */
  csiValue: number;

  /** Violent CSI */
  violentCsi: number | null;

  /** Non-violent CSI */
  nonViolentCsi: number | null;

  sourceUrl: string;

  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  PPSC — Public Prosecution Service of Canada                        */
/* ------------------------------------------------------------------ */

export interface PpscCaseload {
  id: string;

  /** Fiscal year */
  fiscalYear: string;

  /** Type of caseload (e.g. "New Files", "Active Files", "Completed Files") */
  caseloadType: string;

  /** Jurisdiction / court level (e.g. "Provincial", "Superior", "Appeal") */
  courtLevel: string;

  /** Number of files */
  fileCount: number;

  sourceUrl: string;

  ingestedAt: string;
}

export interface PpscOutcome {
  id: string;

  /** Fiscal year */
  fiscalYear: string;

  /** Court level */
  courtLevel: string;

  /** Outcome type (e.g. "Conviction", "Acquittal", "Stay of Proceedings", "Withdrawn") */
  outcomeType: string;

  /** Number of outcomes */
  count: number;

  sourceUrl: string;

  ingestedAt: string;
}

export interface PpscStayRate {
  id: string;

  /** Fiscal year */
  fiscalYear: string;

  /** Court level */
  courtLevel: string;

  /** Total completed */
  totalCompleted: number;

  /** Total stays */
  totalStays: number;

  /** Stay rate (0-100%) */
  stayRate: number | null;

  sourceUrl: string;

  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Youth Criminal Justice                                             */
/* ------------------------------------------------------------------ */

export interface YouthJusticeCase {
  id: string;

  /** Fiscal year */
  fiscalYear: string;

  /** Province/territory */
  provinceTerritory: string;

  /** Case type (e.g. "Diversion", "Custody", "Community Supervision", "Probation") */
  caseType: string;

  /** Number of cases */
  count: number;

  /** Gender */
  gender: string | null;

  /** Age group */
  ageGroup: string | null;

  sourceUrl: string;

  ingestedAt: string;
}

export interface YouthRecidivism {
  id: string;

  /** Fiscal year of initial sentence */
  fiscalYear: string;

  /** Province/territory */
  provinceTerritory: string;

  /** Follow-up period (e.g. "1 year", "2 years", "3 years") */
  followUpPeriod: string;

  /** Re-offence rate (%) */
  recidivismRate: number | null;

  /** Number tracked */
  totalTracked: number;

  /** Number re-offended */
  reOffended: number;

  sourceUrl: string;

  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Legal Aid Funding                                                  */
/* ------------------------------------------------------------------ */

export interface LegalAidFunding {
  id: string;

  /** Fiscal year */
  fiscalYear: string;

  /** Province/territory */
  provinceTerritory: string;

  /** Funding source (e.g. "Federal", "Provincial", "Total Government") */
  fundingSource: string;

  /** Amount (CAD) */
  amount: number;

  sourceUrl: string;

  ingestedAt: string;
}

export interface LegalAidCaseCost {
  id: string;

  /** Fiscal year */
  fiscalYear: string;

  /** Province/territory */
  provinceTerritory: string;

  /** Case type (e.g. "Criminal", "Family", "Immigration", "Civil") */
  caseType: string;

  /** Total cost (CAD) */
  totalCost: number;

  /** Number of cases */
  caseCount: number;

  /** Average cost per case */
  averageCostPerCase: number | null;

  sourceUrl: string;

  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Result                                                  */
/* ------------------------------------------------------------------ */

export interface CriminalJusticeIngestionResult {
  source: string;
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
