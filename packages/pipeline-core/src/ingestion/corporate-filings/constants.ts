import type { FilingTypeCategory } from './types.js';

export const SEDARPLUS_BASE_URL = 'https://www.sedarplus.ca' as const;
export const SEDARPLUS_SEARCH_URL = 'https://www.sedarplus.ca/search/search' as const;
export const SEDARPLUS_LANDING = 'https://www.sedarplus.ca/landing' as const;

export const CKAN_FALLBACK_URL = 'https://open.canada.ca/data/api/3/action/package_search' as const;

export const FILINGS_USER_AGENT = 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)';
export const FILINGS_TIMEOUT_MS = 30_000;
export const MAX_FILINGS = 200;
export const CONCURRENCY_LIMIT = 5;
export const RETRY_COUNT = 3;
export const RETRY_DELAY_MS = 1_000;

export const FILING_TYPE_MAP: Record<string, FilingTypeCategory> = {
  'annual report': 'annual-report',
  'annual information form': 'annual-report',
  'management discussion & analysis': 'management-discussion',
  'management proxy circular': 'proxy-circular',
  'material change report': 'material-change',
  'business acquisition report': 'material-change',
  'takeover bid circular': 'takeover-bid',
  'issuer bid circular': 'issuer-bid',
  'prospectus': 'prospectus',
  'preliminary prospectus': 'prospectus',
  'final prospectus': 'prospectus',
  'supplemental prospectus': 'prospectus',
  'financial statements': 'financial-statement',
  'annual financial statements': 'financial-statement',
  'interim financial statements': 'financial-statement',
  'audited financial statements': 'financial-statement',
  'notice of meeting': 'meeting-materials',
  'information circular': 'meeting-materials',
  'director nomination': 'governance',
  'change in auditor': 'governance',
  'change in fiscal year': 'governance',
  'change of name': 'governance',
  'change of listing': 'corporate-action',
  'stock split': 'corporate-action',
  'consolidation': 'corporate-action',
  'dividend declaration': 'corporate-action',
  'asset purchase agreement': 'acquisition',
  'share purchase agreement': 'acquisition',
  'amalgamation agreement': 'acquisition',
  'arrangement agreement': 'acquisition',
  'press release': 'press-release',
  'news release': 'press-release',
  'other': 'other',
};

export const FILING_TYPE_CATEGORIES: FilingTypeCategory[] = [
  'annual-report', 'management-discussion', 'proxy-circular',
  'material-change', 'financial-statement', 'prospectus',
  'takeover-bid', 'issuer-bid', 'meeting-materials',
  'governance', 'corporate-action', 'acquisition',
  'press-release', 'other',
];

export const CORPORATE_FILINGS_DDL = `
CREATE TABLE IF NOT EXISTS corporate_filings (
  id TEXT PRIMARY KEY,
  issuer_name TEXT NOT NULL,
  issuer_ticker TEXT,
  filing_type TEXT NOT NULL,
  filing_type_category TEXT NOT NULL,
  filing_date TEXT NOT NULL,
  document_url TEXT NOT NULL,
  description TEXT,
  form_type TEXT,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cf_issuer ON corporate_filings(issuer_name);
CREATE INDEX IF NOT EXISTS idx_cf_type ON corporate_filings(filing_type_category);
CREATE INDEX IF NOT EXISTS idx_cf_date ON corporate_filings(filing_date DESC);
CREATE INDEX IF NOT EXISTS idx_cf_source ON corporate_filings(document_url);
`;

export const SEDARPLUS_DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': FILINGS_USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-CA,en;q=0.9',
  'Content-Type': 'application/x-www-form-urlencoded',
};
