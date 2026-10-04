/**
 * SEDAR+ Corporate Filings Constants — Quill
 *
 * URLs and lookup data for the Canadian SEDAR+ system,
 * Canada's national securities filing repository.
 *
 * Sources:
 *   SEDAR+:              https://www.sedarplus.ca
 *   CD Plus API:         https://services.cdplus.ca/api
 *   CSA Disclosure:      https://www.securities-administrators.ca
 */

import type { SedarFilingType, FilingJurisdiction } from './types.js';

/* ------------------------------------------------------------------ */
/*  SEDAR+ URLs                                                        */
/* ------------------------------------------------------------------ */

/** SEDAR+ base URL */
export const SEDARPLUS_BASE_URL = 'https://www.sedarplus.ca' as const;

/** CD Plus API base URL for programmatic access */
export const CDPLUS_API_BASE = 'https://services.cdplus.ca/api' as const;

/** Search endpoint (returns filings filtered by params) */
export const CDPLUS_SEARCH_URL = `${CDPLUS_API_BASE}/v1/filings/search` as const;

/** Issuer endpoint (returns company profile) */
export const CDPLUS_ISSUER_URL = `${CDPLUS_API_BASE}/v1/issuers` as const;

/** Document download endpoint */
export const CDPLUS_DOCUMENT_URL = `${CDPLUS_API_BASE}/v1/documents` as const;

/** Legacy SEDAR search (for historical data not yet migrated to CD Plus) */
export const SEDAR_LEGACY_SEARCH = 'https://www.sedar.com/cca/searchForm_en.htm' as const;

/* ------------------------------------------------------------------ */
/*  Default Request Headers                                            */
/* ------------------------------------------------------------------ */

export const SEDARPLUS_DEFAULT_HEADERS = {
  'User-Agent': 'Quill/0.1 (civic-tech; https://maplespike.ca)',
  Accept: 'application/json,text/html;q=0.9',
  'Accept-Language': 'en-CA,en;q=0.9',
} as const;

/* ------------------------------------------------------------------ */
/*  Filing Type Mappings                                               */
/* ------------------------------------------------------------------ */

/**
 * Mapping of raw SEDAR+ form type strings to canonical SedarFilingType.
 * Covers the most common Canadian securities filing forms.
 */
export const SEDAR_FORM_TYPE_MAP: Record<string, SedarFilingType> = {
  // Annual / Periodic
  'AIF': 'aif',
  'Annual Information Form': 'aif',
  'AR': 'annual-report',
  'Annual Report': 'annual-report',
  'Annual Financial Statement': 'audited-financial-statement',
  'Audited Annual Financial Statements': 'audited-financial-statement',
  
  // Interim Financials
  'Interim Financial Report': 'interim-financial-statement',
  'Interim Financial Statements': 'interim-financial-statement',
  'Q1': 'interim-financial-statement',
  'Q2': 'interim-financial-statement',
  'Q3': 'interim-financial-statement',
  
  // MD&A
  'MD&A': 'management-discussion',
  'Management Discussion and Analysis': 'management-discussion',
  'Management Discussion & Analysis': 'management-discussion',
  'Interim MD&A': 'management-discussion',
  'Annual MD&A': 'management-discussion',
  
  // Proxy / Meetings
  'Proxy Circular': 'proxy-circular',
  'Management Proxy Circular': 'proxy-circular',
  'Notice of Meeting': 'meeting-materials',
  'Notice of Annual Meeting': 'meeting-materials',
  'Meeting Material': 'meeting-materials',
  'Information Circular': 'proxy-circular',
  
  // Material Changes
  'Material Change Report': 'material-change-report',
  'Report of Material Change': 'material-change-report',
  'Business Acquisition Report': 'business-acquisition-report',
  'Notice of Acquisition': 'business-acquisition-report',
  
  // Prospectus / Offerings
  'Preliminary Prospectus': 'prospectus',
  'Final Prospectus': 'prospectus',
  'Prospectus': 'prospectus',
  'Preliminary Short Form Prospectus': 'prospectus',
  'Final Short Form Prospectus': 'prospectus',
  'Preliminary Shelf Prospectus': 'prospectus',
  'Final Shelf Prospectus': 'prospectus',
  'Prospectus Supplement': 'prospectus-supplement',
  'Amendment to Prospectus': 'prospectus-supplement',
  
  // Bids
  'Take-Over Bid': 'takeover-bid',
  'Take-Over Bid Circular': 'takeover-bid',
  'Issuer Bid': 'issuer-bid',
  'Issuer Bid Circular': 'issuer-bid',
  'Rights Offering': 'rights-offering',
  'Rights Offering Circular': 'rights-offering',
  
  // Insider / Ownership
  'Early Warning Report': 'early-warning-report',
  'Early Warning': 'early-warning-report',
  'Insider Report': 'insider-report',
  'Insider Transaction': 'insider-report',
  
  // Governance
  'Corporate Governance Guidelines': 'governance-document',
  'Code of Business Conduct': 'governance-document',
  'Board Charter': 'governance-document',
  'Mandate of the Board': 'governance-document',
  'Audit Committee Charter': 'governance-document',
  'Compensation Committee Charter': 'governance-document',
  
  // Press Releases
  'News Release': 'press-release',
  'Press Release': 'press-release',
};

/* ------------------------------------------------------------------ */
/*  Jurisdiction Codes                                                 */
/* ------------------------------------------------------------------ */

export const JURISDICTION_CODES: Record<string, FilingJurisdiction> = {
  'AB': 'alberta',
  'BC': 'british-columbia',
  'MB': 'manitoba',
  'NB': 'new-brunswick',
  'NL': 'newfoundland-labrador',
  'NS': 'nova-scotia',
  'NT': 'northwest-territories',
  'NU': 'nunavut',
  'ON': 'ontario',
  'PE': 'pei',
  'QC': 'quebec',
  'SK': 'saskatchewan',
  'YT': 'yukon',
  'FED': 'federal',
};

/* ------------------------------------------------------------------ */
/*  Major TSX/TSXV Issuers Tracked for SEDAR+                          */
/* ------------------------------------------------------------------ */

export interface TrackedIssuer {
  name: string;
  ticker: string;
  exchange: 'TSX' | 'TSXV' | 'CSE' | 'NEO';
  sector: string;
}

/**
 * Top Canadian reporting issuers tracked by SEDAR+.
 * Covers the S&P/TSX 60 plus high-interest TSXV/CSE issuers.
 */
export const TRACKED_ISSUERS: TrackedIssuer[] = [
  // Big 5 Banks
  { name: 'Royal Bank of Canada', ticker: 'RY', exchange: 'TSX', sector: 'banking' },
  { name: 'Toronto-Dominion Bank', ticker: 'TD', exchange: 'TSX', sector: 'banking' },
  { name: 'Bank of Nova Scotia', ticker: 'BNS', exchange: 'TSX', sector: 'banking' },
  { name: 'Bank of Montreal', ticker: 'BMO', exchange: 'TSX', sector: 'banking' },
  { name: 'Canadian Imperial Bank of Commerce', ticker: 'CM', exchange: 'TSX', sector: 'banking' },

  // Telecom & Media
  { name: 'BCE Inc.', ticker: 'BCE', exchange: 'TSX', sector: 'telecom' },
  { name: 'Rogers Communications Inc.', ticker: 'RCI.B', exchange: 'TSX', sector: 'telecom' },
  { name: 'Telus Corporation', ticker: 'T', exchange: 'TSX', sector: 'telecom' },
  { name: 'Quebecor Inc.', ticker: 'QBR.B', exchange: 'TSX', sector: 'telecom' },
  { name: 'Shaw Communications Inc.', ticker: 'SJR.B', exchange: 'TSX', sector: 'telecom' },

  // Energy
  { name: 'Enbridge Inc.', ticker: 'ENB', exchange: 'TSX', sector: 'energy' },
  { name: 'TC Energy Corporation', ticker: 'TRP', exchange: 'TSX', sector: 'energy' },
  { name: 'Suncor Energy Inc.', ticker: 'SU', exchange: 'TSX', sector: 'energy' },
  { name: 'Canadian Natural Resources Limited', ticker: 'CNQ', exchange: 'TSX', sector: 'energy' },
  { name: 'Imperial Oil Limited', ticker: 'IMO', exchange: 'TSX', sector: 'energy' },
  { name: 'Cenovus Energy Inc.', ticker: 'CVE', exchange: 'TSX', sector: 'energy' },
  { name: 'Pembina Pipeline Corporation', ticker: 'PPL', exchange: 'TSX', sector: 'energy' },

  // Mining & Metals
  { name: 'Nutrien Ltd.', ticker: 'NTR', exchange: 'TSX', sector: 'mining' },
  { name: 'Barrick Gold Corporation', ticker: 'ABX', exchange: 'TSX', sector: 'mining' },
  { name: 'Agnico Eagle Mines Limited', ticker: 'AEM', exchange: 'TSX', sector: 'mining' },
  { name: 'Wheaton Precious Metals Corp.', ticker: 'WPM', exchange: 'TSX', sector: 'mining' },
  { name: 'Teck Resources Limited', ticker: 'TECK.B', exchange: 'TSX', sector: 'mining' },
  { name: 'Franco-Nevada Corporation', ticker: 'FNV', exchange: 'TSX', sector: 'mining' },

  // Technology
  { name: 'Shopify Inc.', ticker: 'SHOP', exchange: 'TSX', sector: 'technology' },
  { name: 'Constellation Software Inc.', ticker: 'CSU', exchange: 'TSX', sector: 'technology' },
  { name: 'OpenText Corporation', ticker: 'OTEX', exchange: 'TSX', sector: 'technology' },
  { name: 'Lightspeed Commerce Inc.', ticker: 'LSPD', exchange: 'TSX', sector: 'technology' },
  { name: 'Kinaxis Inc.', ticker: 'KXS', exchange: 'TSX', sector: 'technology' },
  { name: 'Nuvei Corporation', ticker: 'NVEI', exchange: 'TSX', sector: 'technology' },

  // Consumer & Retail
  { name: 'Alimentation Couche-Tard Inc.', ticker: 'ATD', exchange: 'TSX', sector: 'retail' },
  { name: 'Loblaw Companies Limited', ticker: 'L', exchange: 'TSX', sector: 'retail' },
  { name: 'Empire Company Limited', ticker: 'EMP.A', exchange: 'TSX', sector: 'retail' },
  { name: 'Metro Inc.', ticker: 'MRU', exchange: 'TSX', sector: 'retail' },
  { name: 'Dollarama Inc.', ticker: 'DOL', exchange: 'TSX', sector: 'retail' },
  { name: 'Canadian Tire Corporation', ticker: 'CTC.A', exchange: 'TSX', sector: 'retail' },
  { name: 'Restaurant Brands International Inc.', ticker: 'QSR', exchange: 'TSX', sector: 'retail' },
  { name: 'Magna International Inc.', ticker: 'MG', exchange: 'TSX', sector: 'manufacturing' },

  // Healthcare / Pharma
  { name: 'Bausch Health Companies Inc.', ticker: 'BHC', exchange: 'TSX', sector: 'life-sciences' },
  { name: 'Chartwell Retirement Residences', ticker: 'CSH.UN', exchange: 'TSX', sector: 'real-estate' },

  // Transport & Industrial
  { name: 'Canadian National Railway Company', ticker: 'CNR', exchange: 'TSX', sector: 'transportation' },
  { name: 'Canadian Pacific Kansas City Limited', ticker: 'CP', exchange: 'TSX', sector: 'transportation' },
  { name: 'Thomson Reuters Corporation', ticker: 'TRI', exchange: 'TSX', sector: 'services' },

  // Financial Services
  { name: 'Manulife Financial Corporation', ticker: 'MFC', exchange: 'TSX', sector: 'financial-services' },
  { name: 'Sun Life Financial Inc.', ticker: 'SLF', exchange: 'TSX', sector: 'financial-services' },
  { name: 'Great-West Lifeco Inc.', ticker: 'GWO', exchange: 'TSX', sector: 'financial-services' },
  { name: 'Intact Financial Corporation', ticker: 'IFC', exchange: 'TSX', sector: 'financial-services' },
  { name: 'Fairfax Financial Holdings Limited', ticker: 'FFH', exchange: 'TSX', sector: 'financial-services' },
  { name: 'Brookfield Corporation', ticker: 'BN', exchange: 'TSX', sector: 'financial-services' },
  { name: 'Brookfield Asset Management Ltd.', ticker: 'BAM', exchange: 'TSX', sector: 'financial-services' },

  // Real Estate
  { name: 'Brookfield Renewable Partners L.P.', ticker: 'BEP.UN', exchange: 'TSX', sector: 'clean-technology' },
  { name: 'RioCan Real Estate Investment Trust', ticker: 'REI.UN', exchange: 'TSX', sector: 'real-estate' },
];

/* ------------------------------------------------------------------ */
/*  Search Parameter Defaults                                          */
/* ------------------------------------------------------------------ */

export const DEFAULT_SEARCH_LIMIT = 50;
export const MAX_SEARCH_LIMIT = 200;
export const SEDARPLUS_TIMEOUT_MS = 30_000;

/* ------------------------------------------------------------------ */
/*  DDL for SEDAR+ filings database table                              */
/* ------------------------------------------------------------------ */

export const SEDARPLUS_DDL = `
CREATE TABLE IF NOT EXISTS sedar_filings (
  filing_id TEXT PRIMARY KEY,
  issuer_id TEXT NOT NULL,
  issuer_name TEXT NOT NULL,
  filing_date TEXT NOT NULL,
  period_end TEXT,
  filing_type TEXT NOT NULL,
  filing_type_raw TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  document_url TEXT NOT NULL,
  file_size_bytes INTEGER,
  file_format TEXT NOT NULL DEFAULT 'pdf',
  language TEXT NOT NULL DEFAULT 'en',
  jurisdiction TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  project_number TEXT,
  is_legacy INTEGER NOT NULL DEFAULT 0,
  ingested_at TEXT NOT NULL,
  UNIQUE(issuer_id, filing_date, document_url)
);

CREATE INDEX IF NOT EXISTS idx_sedar_issuer ON sedar_filings(issuer_name);
CREATE INDEX IF NOT EXISTS idx_sedar_issuer_id ON sedar_filings(issuer_id);
CREATE INDEX IF NOT EXISTS idx_sedar_date ON sedar_filings(filing_date DESC);
CREATE INDEX IF NOT EXISTS idx_sedar_type ON sedar_filings(filing_type);
CREATE INDEX IF NOT EXISTS idx_sedar_jurisdiction ON sedar_filings(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_sedar_issuer_date ON sedar_filings(issuer_name, filing_date DESC);
CREATE INDEX IF NOT EXISTS idx_sedar_status ON sedar_filings(status);
`;

/* ------------------------------------------------------------------ */
/*  Helper Functions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Lookup a tracked issuer by ticker symbol (case-insensitive).
 */
export function findIssuerByTicker(ticker: string): TrackedIssuer | undefined {
  return TRACKED_ISSUERS.find(
    i => i.ticker.toUpperCase() === ticker.toUpperCase(),
  );
}

/**
 * Lookup a tracked issuer by name fragment (case-insensitive).
 */
export function findIssuerByName(nameFragment: string): TrackedIssuer | undefined {
  const lower = nameFragment.toLowerCase();
  return TRACKED_ISSUERS.find(
    i => i.name.toLowerCase().includes(lower) || i.ticker.toLowerCase().includes(lower),
  );
}

/**
 * Map a raw SEDAR+ form type string to a canonical SedarFilingType.
 * Falls back to 'other' for unrecognised forms.
 */
export function classifyFilingType(raw: string): SedarFilingType {
  return SEDAR_FORM_TYPE_MAP[raw.trim()] ?? 'other';
}
