// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Crown Corporations Constants — Quill
 *
 * Known crown corporation configurations, URLs, reporting patterns,
 * default options, and error types.
 *
 * Crown corporations tracked:
 *   - CBC/Radio-Canada (CBC) — public broadcaster
 *   - Canada Post Corporation (CPC) — postal service
 *   - Canadian National Railway (CN) — privatized 1995, tracked for legacy
 *   - Via Rail Canada (VIA) — passenger rail
 *   - Export Development Canada (EDC) — trade financing
 *   - Business Development Bank of Canada (BDC) — small business lending
 *   - Canada Mortgage and Housing Corporation (CMHC) — housing policy
 *   - Canada Council for the Arts (CCC) — arts funding
 *   - National Arts Centre (NAC) — performing arts
 *   - Farm Credit Canada (FCC) — agricultural lending
 *   - Public Sector Pension Investment Board (PSP) — public service pensions
 *
 * Data sources:
 *   - Each crown corp publishes annual reports on their websites
 *   - Some have RSS feeds for press releases/publications
 *   - GC InfoBase has consolidated financial data
 *   - open.canada.ca CKAN has some crown corp datasets
 */

import type { CrownCorporationCode, CrownCorporationConfig } from './types.js';

/* ------------------------------------------------------------------ */
/*  Crown Corporation Configurations                                   */
/* ------------------------------------------------------------------ */

/**
 * CBC/Radio-Canada — Canadian Broadcasting Corporation.
 * Publishes annual reports, quarterly financials, corporate plans,
 * and board meeting minutes on cbc.radio-canada.ca.
 *
 * Annual reports:
 *   https://cbc.radio-canada.ca/en/impact-and-accountability/finance/annual-reports
 * Quarterly financials:
 *   https://cbc.radio-canada.ca/en/impact-and-accountability/finance/quarterly-financial-results
 * Corporate plan:
 *   https://cbc.radio-canada.ca/en/impact-and-accountability/finance/corporate-plan
 * Board:
 *   https://cbc.radio-canada.ca/en/impact-and-accountability/governance/board-of-directors
 */
export const CBC_CONFIG: CrownCorporationConfig = {
  code: 'CBC',
  name: 'Canadian Broadcasting Corporation',
  shortName: 'CBC/Radio-Canada',
  homepageUrl: 'https://cbc.radio-canada.ca',
  annualReportsUrl: 'https://cbc.radio-canada.ca/en/impact-and-accountability/finance/annual-reports',
  quarterlyReportsUrl: 'https://cbc.radio-canada.ca/en/impact-and-accountability/finance/quarterly-financial-results',
  corporatePlanUrl: 'https://cbc.radio-canada.ca/en/impact-and-accountability/finance/corporate-plan',
  boardMinutesUrl: null,
  executiveCompUrl: null,
  rssFeedUrl: null,
  isCurrent: true,
  sector: 'Broadcasting / Media',
  currency: 'CAD',
  notes: 'Publishes bilingual (EN/FR) annual reports with audited financial statements. Quarterly financials available as PDF.',
};

/**
 * Canada Post Corporation — CPC.
 * Publishes annual reports, quarterly financials, and corporate plans.
 *
 * Annual reports:
 *   https://www.canadapost-postescanada.ca/cpc/en/our-company/investors-and-financials/annual-report.page
 * Quarterly:
 *   https://www.canadapost-postescanada.ca/cpc/en/our-company/investors-and-financials/quarterly-financial.page
 */
export const CPC_CONFIG: CrownCorporationConfig = {
  code: 'CPC',
  name: 'Canada Post Corporation',
  shortName: 'Canada Post',
  homepageUrl: 'https://www.canadapost-postescanada.ca',
  annualReportsUrl: 'https://www.canadapost-postescanada.ca/cpc/en/our-company/investors-and-financials/annual-report.page',
  quarterlyReportsUrl: 'https://www.canadapost-postescanada.ca/cpc/en/our-company/investors-and-financials/quarterly-financial.page',
  corporatePlanUrl: null,
  boardMinutesUrl: null,
  executiveCompUrl: null,
  rssFeedUrl: 'https://www.canadapost-postescanada.ca/cpc/rss/newsroom.xml',
  isCurrent: true,
  sector: 'Postal / Logistics',
  currency: 'CAD',
  notes: 'Annual reports include audited statements and management discussion. Quarterly reports published within 60 days of quarter end.',
};

/**
 * Canadian National Railway — CN.
 * Fully privatized in 1995 (IPO). Tracked as a former crown corporation
 * for historical/legacy analysis. Now reports as a public company (TSX: CNR).
 */
export const CN_CONFIG: CrownCorporationConfig = {
  code: 'CN',
  name: 'Canadian National Railway Company',
  shortName: 'CN Rail',
  homepageUrl: 'https://www.cn.ca',
  annualReportsUrl: 'https://www.cn.ca/en/investors/financial-reporting',
  quarterlyReportsUrl: 'https://www.cn.ca/en/investors/financial-reporting',
  corporatePlanUrl: null,
  boardMinutesUrl: null,
  executiveCompUrl: null,
  rssFeedUrl: null,
  isCurrent: false,
  sector: 'Railway / Transportation',
  currency: 'CAD',
  notes: 'Privatized 1995. Public company (TSX:CNR, NYSE:CNI). Tracked for legacy crown corp comparisons.',
};

/**
 * Via Rail Canada — VIA.
 * Publishes annual reports and corporate plans.
 *
 * Annual reports:
 *   https://www.viarail.ca/en/about-viarail/corporate-reports
 */
export const VIA_CONFIG: CrownCorporationConfig = {
  code: 'VIA',
  name: 'Via Rail Canada Inc.',
  shortName: 'Via Rail',
  homepageUrl: 'https://www.viarail.ca',
  annualReportsUrl: 'https://www.viarail.ca/en/about-viarail/corporate-reports/annual-reports',
  quarterlyReportsUrl: null,
  corporatePlanUrl: 'https://www.viarail.ca/en/about-viarail/corporate-reports/corporate-plan',
  boardMinutesUrl: null,
  executiveCompUrl: null,
  rssFeedUrl: null,
  isCurrent: true,
  sector: 'Passenger Railway',
  currency: 'CAD',
  notes: 'Annual reports available in PDF. Corporate plan and summary of corporate plan published annually.',
};

/**
 * Export Development Canada — EDC.
 * Publishes annual reports, quarterly financials, and sustainability reports.
 *
 * Annual reports:
 *   https://www.edc.ca/en/about-us/corporate/annual-report.html
 * Quarterly:
 *   https://www.edc.ca/en/about-us/corporate/quarterly-results.html
 */
export const EDC_CONFIG: CrownCorporationConfig = {
  code: 'EDC',
  name: 'Export Development Canada',
  shortName: 'EDC',
  homepageUrl: 'https://www.edc.ca',
  annualReportsUrl: 'https://www.edc.ca/en/about-us/corporate/annual-report.html',
  quarterlyReportsUrl: 'https://www.edc.ca/en/about-us/corporate/quarterly-results.html',
  corporatePlanUrl: null,
  boardMinutesUrl: null,
  executiveCompUrl: null,
  rssFeedUrl: 'https://www.edc.ca/en/rss.xml',
  isCurrent: true,
  sector: 'Trade Finance / Export Credit',
  currency: 'CAD',
  notes: 'Annual reports include statutory financial statements. Quarterly results available. CSR reports published separately.',
};

/**
 * Business Development Bank of Canada — BDC.
 * Publishes annual reports and quarterly financials.
 *
 * Annual reports:
 *   https://www.bdc.ca/en/about/financial-data/reports
 */
export const BDC_CONFIG: CrownCorporationConfig = {
  code: 'BDC',
  name: 'Business Development Bank of Canada',
  shortName: 'BDC',
  homepageUrl: 'https://www.bdc.ca',
  annualReportsUrl: 'https://www.bdc.ca/en/about/financial-data/reports',
  quarterlyReportsUrl: null,
  corporatePlanUrl: null,
  boardMinutesUrl: null,
  executiveCompUrl: null,
  rssFeedUrl: null,
  isCurrent: true,
  sector: 'Small Business Banking / Development Finance',
  currency: 'CAD',
  notes: 'Annual reports with audited financials. Impact reports also published.',
};

/**
 * Canada Mortgage and Housing Corporation — CMHC.
 * Publishes annual reports, quarterly financials, and housing data.
 *
 * Annual reports:
 *   https://www.cmhc-schl.gc.ca/about-cmhc/corporate-reporting
 * Quarterly:
 *   https://www.cmhc-schl.gc.ca/about-cmhc/corporate-reporting/quarterly-financial-reports
 * Housing data:
 *   https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research
 */
export const CMHC_CONFIG: CrownCorporationConfig = {
  code: 'CMHC',
  name: 'Canada Mortgage and Housing Corporation',
  shortName: 'CMHC',
  homepageUrl: 'https://www.cmhc-schl.gc.ca',
  annualReportsUrl: 'https://www.cmhc-schl.gc.ca/about-cmhc/corporate-reporting',
  quarterlyReportsUrl: 'https://www.cmhc-schl.gc.ca/about-cmhc/corporate-reporting/quarterly-financial-reports',
  corporatePlanUrl: null,
  boardMinutesUrl: null,
  executiveCompUrl: null,
  rssFeedUrl: null,
  isCurrent: true,
  sector: 'Housing / Mortgage Insurance',
  currency: 'CAD',
  notes: 'Comprehensive corporate reporting page. Publishes annual report, quarterly financials, and extensive housing market data.',
};

/**
 * Canada Council for the Arts — CCC.
 * Publishes annual reports and strategic plans.
 *
 * Annual reports:
 *   https://canadacouncil.ca/about/public-accountability
 */
export const CCC_CONFIG: CrownCorporationConfig = {
  code: 'CCC',
  name: 'Canada Council for the Arts',
  shortName: 'Canada Council',
  homepageUrl: 'https://canadacouncil.ca',
  annualReportsUrl: 'https://canadacouncil.ca/about/public-accountability/annual-reports',
  quarterlyReportsUrl: null,
  corporatePlanUrl: null,
  boardMinutesUrl: null,
  executiveCompUrl: null,
  rssFeedUrl: null,
  isCurrent: true,
  sector: 'Arts / Culture Funding',
  currency: 'CAD',
  notes: 'Annual reports and departmental results. Grants data also available.',
};

/**
 * National Arts Centre — NAC.
 * Publishes annual reports.
 *
 * Annual reports:
 *   https://nac-cna.ca/en/about/reports
 */
export const NAC_CONFIG: CrownCorporationConfig = {
  code: 'NAC',
  name: 'National Arts Centre',
  shortName: 'NAC',
  homepageUrl: 'https://nac-cna.ca',
  annualReportsUrl: 'https://nac-cna.ca/en/about/reports',
  quarterlyReportsUrl: null,
  corporatePlanUrl: null,
  boardMinutesUrl: null,
  executiveCompUrl: null,
  rssFeedUrl: null,
  isCurrent: true,
  sector: 'Performing Arts',
  currency: 'CAD',
  notes: 'Annual reports available in PDF. Smaller crown corporation.',
};

/**
 * Farm Credit Canada — FCC.
 * Publishes annual reports and quarterly financials.
 *
 * Annual reports:
 *   https://www.fcc-fac.ca/en/about-fcc/corporate-reports.html
 */
export const FCC_CONFIG: CrownCorporationConfig = {
  code: 'FCC',
  name: 'Farm Credit Canada',
  shortName: 'FCC',
  homepageUrl: 'https://www.fcc-fac.ca',
  annualReportsUrl: 'https://www.fcc-fac.ca/en/about-fcc/corporate-reports.html',
  quarterlyReportsUrl: null,
  corporatePlanUrl: null,
  boardMinutesUrl: null,
  executiveCompUrl: null,
  rssFeedUrl: null,
  isCurrent: true,
  sector: 'Agricultural Finance',
  currency: 'CAD',
  notes: 'Annual reports and quarterly updates available.',
};

/**
 * Public Sector Pension Investment Board — PSP Investments.
 * Publishes annual reports.
 *
 * Annual reports:
 *   https://www.investissementspsp-pspinvestments.ca/en/news-publications/publications
 */
export const PSP_CONFIG: CrownCorporationConfig = {
  code: 'PBC', // Uses 'PBC' code per type definition
  name: 'Public Sector Pension Investment Board',
  shortName: 'PSP Investments',
  homepageUrl: 'https://www.investissementspsp-pspinvestments.ca',
  annualReportsUrl: 'https://www.investissementspsp-pspinvestments.ca/en/news-publications/publications',
  quarterlyReportsUrl: null,
  corporatePlanUrl: null,
  boardMinutesUrl: null,
  executiveCompUrl: null,
  rssFeedUrl: null,
  isCurrent: true,
  sector: 'Pension Investment',
  currency: 'CAD',
  notes: 'Annual reports with detailed investment performance.',
};

/* ------------------------------------------------------------------ */
/*  Org Registry                                                       */
/* ------------------------------------------------------------------ */

/**
 * All crown corporation configurations keyed by code.
 */
export const CROWN_CORP_CONFIGS: Record<string, CrownCorporationConfig> = {
  CBC: CBC_CONFIG,
  CPC: CPC_CONFIG,
  CN: CN_CONFIG,
  VIA: VIA_CONFIG,
  EDC: EDC_CONFIG,
  BDC: BDC_CONFIG,
  CMHC: CMHC_CONFIG,
  CCC: CCC_CONFIG,
  NAC: NAC_CONFIG,
  FCC: FCC_CONFIG,
  PBC: PSP_CONFIG,
};

/**
 * Ordered list of all crown corporation configurations.
 */
export const ALL_CROWN_CORPS: CrownCorporationConfig[] = Object.values(CROWN_CORP_CONFIGS);

/**
 * Current crown corporations (active/government-owned).
 */
export const CURRENT_CROWN_CORPS: CrownCorporationConfig[] = ALL_CROWN_CORPS.filter((c) => c.isCurrent);

/**
 * Crown corporations that publish quarterly financial reports.
 */
export const QUARTERLY_REPORTING_CORPS: CrownCorporationConfig[] = [
  CBC_CONFIG,
  CPC_CONFIG,
  CMHC_CONFIG,
  EDC_CONFIG,
];

/**
 * Crown corporations with RSS feeds for publications.
 */
export const RSS_FEED_CORPS: CrownCorporationConfig[] = [
  CPC_CONFIG,
  EDC_CONFIG,
];

/* ------------------------------------------------------------------ */
/*  Report Type Patterns                                               */
/* ------------------------------------------------------------------ */

/**
 * Known URL patterns for annual reports by crown corporation.
 * Used by the fetcher to construct report URLs.
 */
export const ANNUAL_REPORT_URL_PATTERNS: Record<CrownCorporationCode, string> = {
  CBC: 'https://cbc.radio-canada.ca/en/impact-and-accountability/finance/annual-reports',
  CPC: 'https://www.canadapost-postescanada.ca/cpc/en/our-company/investors-and-financials/annual-report.page',
  CN: 'https://www.cn.ca/en/investors/financial-reporting',
  VIA: 'https://www.viarail.ca/en/about-viarail/corporate-reports/annual-reports',
  EDC: 'https://www.edc.ca/en/about-us/corporate/annual-report.html',
  BDC: 'https://www.bdc.ca/en/about/financial-data/reports',
  CMHC: 'https://www.cmhc-schl.gc.ca/about-cmhc/corporate-reporting',
  CCC: 'https://canadacouncil.ca/about/public-accountability/annual-reports',
  NAC: 'https://nac-cna.ca/en/about/reports',
  NRC: 'https://nrc.canada.ca/en/corporate/reports',
  CBCL: 'https://www.cbdc.ca/en',
  FCC: 'https://www.fcc-fac.ca/en/about-fcc/corporate-reports.html',
  PBC: 'https://www.investissementspsp-pspinvestments.ca/en/news-publications/publications',
  'C.D.C.': '',
  OTHER: '',
};

/* ------------------------------------------------------------------ */
/*  Default Options                                                    */
/* ------------------------------------------------------------------ */

/** Default max records per org when fetching */
export const DEFAULT_MAX_RECORDS = 100;

/** Default User-Agent for HTTP requests */
export const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:hello@maplespike.ca)';

/** Default request timeout in milliseconds */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Default request headers */
export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/pdf,application/json,*/*',
};

/* ------------------------------------------------------------------ */
/*  Error Types                                                        */
/* ------------------------------------------------------------------ */

export class CrownCorporationError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'CROWN_CORP_ERROR',
    public readonly org?: CrownCorporationCode,
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'CrownCorporationError';
  }
}
