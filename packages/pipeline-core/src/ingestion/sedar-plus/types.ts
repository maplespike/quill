/**
 * SEDAR+ Corporate Filings Types — Quill
 *
 * Types for Canadian securities filings from SEDAR+ (sedarplus.ca),
 * the national system for electronic document analysis and retrieval
 * operated by the Canadian Securities Administrators (CSA).
 *
 * SEDAR+ replaced the legacy SEDAR system in 2024 and serves as Canada's
 * EDGAR-equivalent — all reporting issuers (TSX/TSXV/CSE/NEO listed
 * companies) must file documents through this system.
 *
 * Sources:
 *   SEDAR+: https://www.sedarplus.ca
 *   CD Plus API: https://services.cdplus.ca/api
 */

/** SEDAR+ document types / form categories */
export type SedarFilingType = 
  | 'annual-report'
  | 'aif'                          // Annual Information Form
  | 'audited-financial-statement'
  | 'interim-financial-statement'
  | 'management-discussion'
  | 'proxy-circular'
  | 'material-change-report'
  | 'business-acquisition-report'
  | 'prospectus'
  | 'prospectus-supplement'
  | 'takeover-bid'
  | 'issuer-bid'
  | 'rights-offering'
  | 'early-warning-report'
  | 'insider-report'
  | 'meeting-materials'
  | 'governance-document'
  | 'press-release'
  | 'other';

/** SEDAR+ industry classification */
export type SedarIndustrySector =
  | 'agriculture'
  | 'biotechnology'
  | 'clean-technology'
  | 'communications-media'
  | 'consumer-products'
  | 'financial-services'
  | 'gaming'
  | 'industrial'
  | 'insurance'
  | 'investment-funds'
  | 'life-sciences'
  | 'manufacturing'
  | 'mining'
  | 'oil-gas'
  | 'real-estate'
  | 'retail'
  | 'services'
  | 'technology'
  | 'transportation'
  | 'other';

/** Jurisdiction in which a filing was made */
export type FilingJurisdiction =
  | 'federal'     // National Instrument 0-101
  | 'ontario'
  | 'quebec'
  | 'british-columbia'
  | 'alberta'
  | 'saskatchewan'
  | 'manitoba'
  | 'nova-scotia'
  | 'new-brunswick'
  | 'newfoundland-labrador'
  | 'pei'
  | 'yukon'
  | 'northwest-territories'
  | 'nunavut';

/** Status of a filing in the SEDAR+ system */
export type FilingStatus = 'active' | 'superseded' | 'withdrawn' | 'revoked';

/** A single SEDAR+ company / reporting issuer */
export interface SedarIssuer {
  /** SEDAR+ issuer ID */
  issuerId: string;
  /** Legal name */
  name: string;
  /** Stock ticker symbols (exchange: ticker) */
  tickers: Array<{ exchange: string; symbol: string }>;
  /** Primary industry sector */
  sector: SedarIndustrySector | null;
  /** Head office jurisdiction */
  jurisdiction: FilingJurisdiction | null;
  /** Head office city */
  city: string | null;
  /** Status in the system */
  active: boolean;
}

/** A single SEDAR+ filing document */
export interface SedarFiling {
  /** Unique filing ID in SEDAR+ */
  filingId: string;
  /** Issuer who filed */
  issuerId: string;
  /** Issuer name at time of filing */
  issuerName: string;
  /** Filing date (ISO-8601 YYYY-MM-DD) */
  filingDate: string;
  /** Report date / period end date */
  periodEnd: string | null;
  /** Filing type category */
  filingType: SedarFilingType;
  /** Filing type as reported by SEDAR+ (raw) */
  filingTypeRaw: string;
  /** Document title */
  title: string;
  /** Document description */
  description: string | null;
  /** Document URL (on sedarplus.ca) */
  documentUrl: string;
  /** PDF/HTML file size in bytes */
  fileSizeBytes: number | null;
  /** File format extension */
  fileFormat: 'pdf' | 'html' | 'docx' | 'xlsx' | 'txt' | 'other';
  /** Filing language */
  language: 'en' | 'fr' | 'bilingual';
  /** Jurisdiction where filed */
  jurisdiction: FilingJurisdiction;
  /** Filing status */
  status: FilingStatus;
  /** CSA project number (if applicable) */
  projectNumber: string | null;
  /** Whether filing is SEDAR+ client or legacy migrated */
  isLegacy: boolean;
  /** Ingestion metadata */
  ingestedAt: string;
}

/** Parameters for searching SEDAR+ filings */
export interface SedarSearchParams {
  /** Issuer name or ticker */
  issuer?: string;
  /** Filing type filter (one or more) */
  filingTypes?: SedarFilingType[];
  /** Date range start (ISO-8601) */
  fromDate?: string;
  /** Date range end (ISO-8601) */
  toDate?: string;
  /** Jurisdiction filter */
  jurisdiction?: FilingJurisdiction;
  /** Keyword search in document title */
  keyword?: string;
  /** Maximum results (default 50, max 200) */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

/** Result of a SEDAR+ search operation */
export interface SedarSearchResult {
  /** Total results matching the query */
  total: number;
  /** Results returned for this page */
  results: SedarFiling[];
  /** Pagination offset used */
  offset: number;
  /** Limit used */
  limit: number;
  /** Whether more results are available */
  hasMore: boolean;
}

/** Ingestion result for a SEDAR+ fetch cycle */
export interface SedarIngestionResult {
  /** Number of filings found */
  totalFound: number;
  /** Number successfully fetched */
  totalFetched: number;
  /** Number of unique filings */
  totalUnique: number;
  /** Number of new filings ingested */
  totalNew: number;
  /** Any errors encountered */
  errors: string[];
  /** Duration in ms */
  durationMs: number;
  /** Issuer processed (if applicable) */
  issuerName?: string;
  /** Fetched filings (returned in dry-run mode) */
  filings?: SedarFiling[];
}

/** CD Plus API response wrapper */
export interface CdPlusApiResponse<T> {
  data: T[];
  pagination: {
    total: number;
    offset: number;
    limit: number;
  };
}
