export const FILINGS_USER_AGENT = 'MapleSpike-CorporateFilings/1.0';
export const FILINGS_TIMEOUT_MS = 15_000;
export const MAX_FILINGS = 200;
export const RETRY_COUNT = 3;
export const RETRY_DELAY_MS = 1000;
export const CONCURRENCY_LIMIT = 5;

export const SEDARPLUS_BASE_URL = 'https://www.sedarplus.ca';
export const SEDARPLUS_SEARCH_URL = 'https://www.sedarplus.ca/DisplayProfile.do?docType=company&issuerName=';
export const SEDARPLUS_LANDING = 'https://www.sedarplus.ca/LandingPage.do';
export const CKAN_FALLBACK_URL = 'https://open.canada.ca/data/en/api/3/action/package_search';

export const SEDARPLUS_DEFAULT_HEADERS = {
  'User-Agent': FILINGS_USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-CA,en-US;q=0.9,en;q=0.8',
};

export const FILING_TYPE_MAP: Record<string, string> = {
  'annual': 'annual-report',
  'md&a': 'management-discussion',
  'management discussion': 'management-discussion',
  'md and a': 'management-discussion',
  'proxy': 'proxy-circular',
  'circular': 'proxy-circular',
  'material change': 'material-change',
  'financial': 'financial-statement',
  'interim': 'financial-statement',
  'prospectus': 'prospectus',
  'takeover': 'takeover-bid',
  'bid': 'issuer-bid',
  'meeting': 'meeting-materials',
  'governance': 'governance',
  'acquisition': 'acquisition',
  'press release': 'press-release',
  'news': 'press-release',
};

export const FILING_TYPE_CATEGORIES = [
  'annual-report',
  'management-discussion',
  'proxy-circular',
  'material-change',
  'financial-statement',
  'prospectus',
  'takeover-bid',
  'issuer-bid',
  'meeting-materials',
  'governance',
  'corporate-action',
  'acquisition',
  'press-release',
  'other',
] as const;

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
  ingested_at TEXT NOT NULL,
  UNIQUE(issuer_name, filing_type, filing_date, id)
);

CREATE INDEX IF NOT EXISTS idx_cf_issuer ON corporate_filings(issuer_name);
CREATE INDEX IF NOT EXISTS idx_cf_ticker ON corporate_filings(issuer_ticker);
CREATE INDEX IF NOT EXISTS idx_cf_filing_type ON corporate_filings(filing_type);
CREATE INDEX IF NOT EXISTS idx_cf_category ON corporate_filings(filing_type_category);
CREATE INDEX IF NOT EXISTS idx_cf_date ON corporate_filings(filing_date DESC);
CREATE INDEX IF NOT EXISTS idx_cf_issuer_date ON corporate_filings(issuer_name, filing_date DESC);
CREATE INDEX IF NOT EXISTS idx_cf_ticker_date ON corporate_filings(issuer_ticker, filing_date DESC);
`;
