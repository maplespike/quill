/**
 * SEDI Constants — Quill
 *
 * URLs for the Canadian System for Electronic Disclosure by Insiders (SEDI)
 * and SEDAR+, plus a curated list of major TSX issuers and tracked
 * executive organizations.
 *
 * Sources:
 *   SEDI search: https://www.sedi.ca/sedi/SVTOCPublish?language=en
 *   SEDAR+:      https://www.sedarplus.ca
 */

import type { InsiderDataSource } from './types.js';

/* ------------------------------------------------------------------ */
/*  SEDI / SEDAR+ URLs                                                 */
/* ------------------------------------------------------------------ */

export const SEDI_BASE_URL = 'https://www.sedi.ca' as const;
export const SEDI_SEARCH_URL = 'https://www.sedi.ca/sedi/SVTOCPublish?language=en' as const;

/** SEDI report detail pages follow this pattern: /sedi/{language}/SVTOCDetail?id={reportId} */
export const SEDI_REPORT_DETAIL = 'https://www.sedi.ca/sedi/SVTOCDetail' as const;

/** SEDAR+ base URL for insider reports */
export const SEDARPLUS_BASE_URL = 'https://www.sedarplus.ca' as const;

/** SEDAR+ insider transaction search (if API-based endpoint exists) */
export const SEDARPLUS_SEARCH_URL = 'https://www.sedarplus.ca/insider-transactions' as const;

/**
 * Data source configurations.
 * SEDI is the primary source (HTML form-based); SEDAR+ is fallback.
 */
export const INSIDER_SOURCES: Record<InsiderDataSource, { baseUrl: string; searchUrl: string; label: string }> = {
  sedi: {
    baseUrl: SEDI_BASE_URL,
    searchUrl: SEDI_SEARCH_URL,
    label: 'SEDI — System for Electronic Disclosure by Insiders',
  },
  sedarplus: {
    baseUrl: SEDARPLUS_BASE_URL,
    searchUrl: SEDARPLUS_SEARCH_URL,
    label: 'SEDAR+ — Insider Reports',
  },
};

/* ------------------------------------------------------------------ */
/*  Default HTTP headers for SEDI requests                             */
/* ------------------------------------------------------------------ */

export const SEDI_DEFAULT_HEADERS = {
  'User-Agent': 'Quill/0.1 (civic-tech; mailto:hello@maplespike.ca)',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-CA,en;q=0.9',
  'Content-Type': 'application/x-www-form-urlencoded',
} as const;

/* ------------------------------------------------------------------ */
/*  Major Canadian Issuers (TSX)                                       */
/* ------------------------------------------------------------------ */

export interface MajorIssuer {
  name: string;
  ticker: string;
  /** Sector classification */
  sector: 'banking' | 'telecom' | 'energy' | 'mining' | 'tech' | 'retail' | 'pharma' | 'media' | 'transport' | 'insurance' | 'other';
}

/**
 * Major TSX-listed Canadian public companies.
 * Covers the TSX 60 plus additional tracked issuers.
 */
export const MAJOR_TSX_ISSUERS: MajorIssuer[] = [
  // Big 5 Banks
  { name: 'Royal Bank of Canada', ticker: 'RY', sector: 'banking' },
  { name: 'Toronto-Dominion Bank', ticker: 'TD', sector: 'banking' },
  { name: 'Bank of Nova Scotia', ticker: 'BNS', sector: 'banking' },
  { name: 'Bank of Montreal', ticker: 'BMO', sector: 'banking' },
  { name: 'Canadian Imperial Bank of Commerce', ticker: 'CM', sector: 'banking' },

  // Telecom
  { name: 'BCE Inc.', ticker: 'BCE', sector: 'telecom' },
  { name: 'Rogers Communications Inc.', ticker: 'RCI.B', sector: 'telecom' },
  { name: 'Telus Corporation', ticker: 'T', sector: 'telecom' },
  { name: 'Quebecor Inc.', ticker: 'QBR.B', sector: 'telecom' },

  // Energy
  { name: 'Enbridge Inc.', ticker: 'ENB', sector: 'energy' },
  { name: 'TC Energy Corporation', ticker: 'TRP', sector: 'energy' },
  { name: 'Suncor Energy Inc.', ticker: 'SU', sector: 'energy' },
  { name: 'Canadian Natural Resources Limited', ticker: 'CNQ', sector: 'energy' },
  { name: 'Imperial Oil Limited', ticker: 'IMO', sector: 'energy' },
  { name: 'Cenovus Energy Inc.', ticker: 'CVE', sector: 'energy' },
  { name: 'Pembina Pipeline Corporation', ticker: 'PPL', sector: 'energy' },

  // Mining
  { name: 'Nutrien Ltd.', ticker: 'NTR', sector: 'mining' },
  { name: 'Barrick Gold Corporation', ticker: 'ABX', sector: 'mining' },
  { name: 'Agnico Eagle Mines Limited', ticker: 'AEM', sector: 'mining' },
  { name: 'Wheaton Precious Metals Corp.', ticker: 'WPM', sector: 'mining' },
  { name: 'Teck Resources Limited', ticker: 'TECK.B', sector: 'mining' },

  // Tech
  { name: 'Shopify Inc.', ticker: 'SHOP', sector: 'tech' },
  { name: 'Constellation Software Inc.', ticker: 'CSU', sector: 'tech' },
  { name: 'OpenText Corporation', ticker: 'OTEX', sector: 'tech' },
  { name: 'Lightspeed Commerce Inc.', ticker: 'LSPD', sector: 'tech' },
  { name: 'Kinaxis Inc.', ticker: 'KXS', sector: 'tech' },

  // Retail
  { name: 'Alimentation Couche-Tard Inc.', ticker: 'ATD', sector: 'retail' },
  { name: 'Loblaw Companies Limited', ticker: 'L', sector: 'retail' },
  { name: 'Empire Company Limited', ticker: 'EMP.A', sector: 'retail' },
  { name: 'Metro Inc.', ticker: 'MRU', sector: 'retail' },
  { name: 'Dollarama Inc.', ticker: 'DOL', sector: 'retail' },
  { name: 'Canadian Tire Corporation', ticker: 'CTC.A', sector: 'retail' },

  // Pharma / Healthcare
  { name: 'Bausch Health Companies Inc.', ticker: 'BHC', sector: 'pharma' },

  // Media
  { name: 'Corus Entertainment Inc.', ticker: 'CJR.B', sector: 'media' },
  { name: 'Postmedia Network Canada Corp.', ticker: 'PNC.B', sector: 'media' },

  // Transport
  { name: 'Canadian National Railway Company', ticker: 'CNR', sector: 'transport' },
  { name: 'Canadian Pacific Kansas City Limited', ticker: 'CP', sector: 'transport' },

  // Insurance
  { name: 'Manulife Financial Corporation', ticker: 'MFC', sector: 'insurance' },
  { name: 'Sun Life Financial Inc.', ticker: 'SLF', sector: 'insurance' },
  { name: 'Great-West Lifeco Inc.', ticker: 'GWO', sector: 'insurance' },
  { name: 'Intact Financial Corporation', ticker: 'IFC', sector: 'insurance' },
  { name: 'Fairfax Financial Holdings Limited', ticker: 'FFH', sector: 'insurance' },

  // Other Major
  { name: 'Thomson Reuters Corporation', ticker: 'TRI', sector: 'other' },
  { name: 'Brookfield Corporation', ticker: 'BN', sector: 'other' },
  { name: 'Brookfield Asset Management Ltd.', ticker: 'BAM', sector: 'other' },
  { name: 'Restaurant Brands International Inc.', ticker: 'QSR', sector: 'other' },
  { name: 'Magna International Inc.', ticker: 'MG', sector: 'other' },
];

/**
 * Lookup a major issuer by ticker symbol (case-insensitive).
 */
export function findIssuerByTicker(ticker: string): MajorIssuer | undefined {
  return MAJOR_TSX_ISSUERS.find(
    i => i.ticker.toUpperCase() === ticker.toUpperCase(),
  );
}

/**
 * Lookup a major issuer by name fragment (case-insensitive substring match).
 */
export function findIssuerByName(nameFragment: string): MajorIssuer | undefined {
  const lower = nameFragment.toLowerCase();
  return MAJOR_TSX_ISSUERS.find(
    i => i.name.toLowerCase().includes(lower) || i.ticker.toLowerCase().includes(lower),
  );
}

/**
 * Organizations of the 17 tracked executives from TRACKED_EXECUTIVES.
 * These are the C-Suite individuals whose trades are most newsworthy.
 */
export const TRACKED_EXEC_ORGS: string[] = [
  'CIBC',
  'RBC',
  'Telus',
  'BCE / Bell Canada',
  'Rogers Communications',
  'CBC/Radio-Canada',
  'Quebecor',
  'Corus Entertainment',
  'Bell Media',
  'Rogers Media',
  'Postmedia Network',
  'The Globe and Mail',
  'Toronto Star / NordStar',
  'La Presse',
  'Canadian Association of Broadcasters',
  'Canadian Journalism Forum',
];

/* ------------------------------------------------------------------ */
/*  DDL for insider_transactions table (schema reference)              */
/* ------------------------------------------------------------------ */

/**
 * DDL for the insider_transactions table.
 * Matches the schema defined in ../../schema/d1.sql.
 */
export const SEDI_DDL = `
CREATE TABLE IF NOT EXISTS insider_transactions (
  id TEXT PRIMARY KEY,
  insider_name TEXT NOT NULL,
  insider_relation TEXT,
  issuer_name TEXT NOT NULL,
  issuer_ticker TEXT,
  transaction_date TEXT NOT NULL,
  filing_date TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  security_type TEXT,
  number_of_units REAL NOT NULL,
  unit_price REAL NOT NULL,
  total_value REAL NOT NULL,
  currency TEXT DEFAULT 'CAD',
  ownership_after REAL,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_insider_name ON insider_transactions(insider_name);
CREATE INDEX IF NOT EXISTS idx_insider_issuer ON insider_transactions(issuer_name);
CREATE INDEX IF NOT EXISTS idx_insider_date ON insider_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_insider_type ON insider_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_insider_source ON insider_transactions(source_url);
`;
