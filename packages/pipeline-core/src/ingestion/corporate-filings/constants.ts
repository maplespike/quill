// SPDX-License-Identifier: AGPL-3.0-only
export const FILINGS_USER_AGENT = 'MapleSpike-CorporateFilings/2.0';
export const FILINGS_TIMEOUT_MS = 60_000;
export const MAX_FILINGS = 5000;

export const FED_CORP_CKAN_ID = '0032ce54-c5dd-4b66-99a0-320a7b5e99f2';

export const FED_CORP_CSV_URLS = [
  { name: 'active-business', url: 'https://d4bf66bykfyaf.cloudfront.net/corporations-active-cbca-en.csv' },
  { name: 'active-other', url: 'https://d4bf66bykfyaf.cloudfront.net/corporations-active-non-cbca-en.csv' },
  { name: 'inactive-business', url: 'https://d4bf66bykfyaf.cloudfront.net/corporations-inactive-or-dissolved-cbca-en.csv' },
  { name: 'inactive-other', url: 'https://d4bf66bykfyaf.cloudfront.net/corporations-inactive-or-dissolved-non-cbca-en.csv' },
];

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
