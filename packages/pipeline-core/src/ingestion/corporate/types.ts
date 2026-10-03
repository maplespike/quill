/**
 * Corporate Data Types — MapleSpike Pipeline
 *
 * Types for Canadian corporate/business source data:
 *   - Federal lobbying registry (who's lobbying who)
 *   - Government procurement (CanadaBuys contract awards)
 *   - Corporate registry (who owns/controls what)
 *   - Executive statements (public filings, testimony, earnings calls)
 *   - Insider transactions (SEDI — executive stock trades)
 *
 * Source terms vary by registry, publisher, dataset, and API. Public access does not establish reuse permission.
 */

/* ------------------------------------------------------------------ */
/*  Lobbying Registry                                                  */
/* ------------------------------------------------------------------ */

export interface LobbyingRecord {
  /** SHA-256 citation hash */
  id: string;

  registrantName: string;
  registrantClient: string | null;
  registrantAddress: string | null;

  /** The organization being represented */
  clientName: string;
  clientBusiness: string | null;

  /** Subject matter (e.g. "Taxation", "Industry", "Health") */
  subjectMatter: string[];

  /** Government institution contacted */
  governmentInstitution: string | null;

  /** Specific public office holder contacted */
  publicOfficeHolder: string | null;

  /** Communication date */
  communicationDate: string;

  /** Lobbying period (start-end) */
  startDate: string | null;
  endDate: string | null;

  /** Lobbying cost for the period */
  lobbyingCostCad: number | null;

  /** Is this an in-house lobbyist or consultant? */
  lobbyistType: 'consultant' | 'in-house' | 'organization';

  /** Source URL */
  sourceUrl: string;

  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Procurement / Contract Awards                                      */
/* ------------------------------------------------------------------ */

export interface ContractAward {
  /** SHA-256 citation hash */
  id: string;

  /** Vendor (company) name */
  vendorName: string;
  vendorAddress: string | null;

  /** Contract value */
  contractValue: number;
  currency: string; // 'CAD'

  /** Contract period */
  awardDate: string;
  startDate: string | null;
  endDate: string | null;

  /** Contract description */
  description: string | null;

  /** Department that awarded the contract */
  department: string;
  departmentAcronym: string | null;

  /** Procurement method (e.g. "Competitive", "Sole Source") */
  procurementMethod: string | null;

  /** Goods and Services Identifier (GSIN) */
  gsin: string | null;

  /** Trade agreement identifier */
  tradeAgreement: string | null;

  /** Number of bids received */
  bidsReceived: number | null;

  /** Source URL */
  sourceUrl: string;

  /** Is this a sole-source contract (high risk indicator)? */
  isSoleSource: boolean;

  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Corporate Registry / Entity Info                                   */
/* ------------------------------------------------------------------ */

export interface CorporateEntity {
  /** Federal corporation number */
  corporationNumber: string;

  /** Legal name */
  legalName: string;

  /** Operating / business names */
  operatingNames: string[];

  /** Jurisdiction (federal, province) */
  jurisdiction: string;

  /** Status (active, dissolved, etc.) */
  status: string;

  /** Date of incorporation */
  incorporationDate: string | null;

  /** Registered office address */
  officeAddress: string | null;

  /** Director names */
  directors: string[];

  /** Last annual return filed */
  lastAnnualReturn: string | null;

  /** Source URL */
  sourceUrl: string;

  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Executive Statements & Filings                                     */
/* ------------------------------------------------------------------ */

export interface ExecutiveStatement {
  /** SHA-256 citation hash */
  id: string;

  /** Executive name */
  executiveName: string;
  executiveTitle: string | null;

  /** Organization */
  organization: string;
  organizationTicker: string | null;

  /** Type of statement */
  statementType: 'earnings-call' | 'press-release' | 'regulatory-filing'
    | 'committee-testimony' | 'public-speech' | 'agm' | 'other';

  /** Statement date */
  date: string;

  /** Title / headline */
  title: string;

  /** Full text of statement */
  text: string;

  /** Context / excerpt */
  excerpt: string | null;

  /** Source URL */
  sourceUrl: string;

  /** Topic tags (e.g. "revenue", "regulation", "layoffs") */
  topics: string[];

  /** Is this from a committee appearance (already captured by committees module)? */
  isCommitteeAppearance: boolean;
  /** Link to committee meeting ID if applicable */
  committeeMeetingId: string | null;

  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Insider Transactions (SEDI)                                        */
/* ------------------------------------------------------------------ */

export interface InsiderTransaction {
  /** SHA-256 citation hash */
  id: string;

  /** Insider name */
  insiderName: string;
  insiderRelation: string | null; // "Director", "CEO", "10% Holder"

  /** Issuer */
  issuerName: string;
  issuerTicker: string | null;

  /** Transaction details */
  transactionDate: string;
  filingDate: string;
  transactionType: 'acquisition' | 'disposition' | 'grant' | 'exercise' | 'other';
  securityType: string;
  numberOfUnits: number;
  unitPrice: number;
  totalValue: number;
  currency: string;

  /** Remaining holdings */
  ownershipAfter: number | null;

  /** Source URL */
  sourceUrl: string;

  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Aggregated Results                                                 */
/* ------------------------------------------------------------------ */

export interface ContractFlag {
  type: 'sole-source' | 'high-value' | 'non-competitive';
  severity: 'low' | 'medium' | 'high';
  contractId: string;
  title: string;
  organization: string;
  value: number | null;
  reason: string;
  sourceUrl: string;
}

export interface CorporateIngestionResult {
  source: string;
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
  /** Parsed records returned when db is null (dry-run mode) */
  records?: unknown[];
  /** Flagged contracts detected during ingestion */
  flaggedContracts?: ContractFlag[];
}
