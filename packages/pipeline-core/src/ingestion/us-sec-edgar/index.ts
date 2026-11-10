// SPDX-License-Identifier: AGPL-3.0-only
/**
 * US SEC EDGAR Ingestion Module
 *
 * Ingests SEC company filings and financial data from EDGAR system.
 * No authentication required - public data.
 *
 * Data includes:
 * - Company submissions (CIK, filings, business info)
 * - XBRL financial statements (balance sheet, income statement)
 * - Form 10-K, 10-Q, 8-K filings
 *
 * API Documentation: https://www.sec.gov/edgar/sec-api-documentation
 */

import { httpGet } from '../../utils/http.js';

const SEC_API_BASE = 'https://data.sec.gov';
const SEC_TIMEOUT_MS = 15_000;
const SEC_USER_AGENT = 'MapleSpike-SEC/1.0 (+https://github.com/reverb256/quill)';

interface SECCompanyInfo {
  cik: string;
  entityType: string;
  sic: string;
  sicDescription: string;
  ownerOrg: string;
  tradingSymbol: string;
}

interface SECFiling {
  accessionNumber: string;
  filingDate: string;
  reportDate: string;
  acceptanceDateTime: string;
  act: string;
  form: string;
  fileNumber: string;
  filmNumber: string;
  items: string;
  size: number;
  isXbrl: boolean;
  isInlineXbrl: boolean;
  primaryDocument: string;
  primaryDocDescription: string;
}

interface SECSubmission {
  cik: string;
  entityType: string;
  sic: string;
  sicDescription: string;
  ownerOrg: string;
  tradingSymbol: string;
  insiderTransactionForOwnerExists: boolean;
  insiderTransactionForIssuerExists: boolean;
  edgarCompanyName: string;
  tickers: string[];
  exchanges: string[];
  ein: string;
  description: string;
  category: string;
  fiscalYearEnd: string;
  stateOfIncorporation: string;
  stateOfIncorporationDescription: string;
  addresses: {
    business: {
      street1: string;
      street2: string;
      city: string;
      stateOrCountry: string;
      zipCode: string;
      stateOrCountryDescription: string;
    };
    mailing: {
      street1: string;
      street2: string;
      city: string;
      stateOrCountry: string;
      zipCode: string;
      stateOrCountryDescription: string;
    };
  };
  filings: {
    recent: SECFiling[];
    files: Array<{
      name: string;
      filingFrom: string;
      filingTo: string;
    }>;
  };
}

/**
 * Fetch SEC company submission data by CIK.
 * @param cik - Company CIK identifier (can be 10 digits with leading zeros, or numeric string)
 * @returns Complete submission data including company info and recent filings
 */
export async function fetchCompanySubmission(cik: string): Promise<SECSubmission> {
  const paddedCik = cik.padStart(10, '0');
  const url = `${SEC_API_BASE}/submissions/CIK${paddedCik}.json`;

  const resp = await httpGet(url, {
    timeoutMs: SEC_TIMEOUT_MS,
    headers: {
      'User-Agent': SEC_USER_AGENT,
      'Accept': 'application/json',
    },
  });

  if (resp.statusCode >= 400) {
    throw new Error(`SEC API error: HTTP ${resp.statusCode}`);
  }

  return JSON.parse(resp.body);
}

/**
 * Search company by CIK or ticker.
 * @param query - CIK (numeric) or ticker symbol
 * @returns Company information if found
 */
export async function searchCompany(query: string): Promise<SECCompanyInfo | null> {
  try {
    const isNumeric = /^\d+$/.test(query);
    const cik = isNumeric ? query.padStart(10, '0') : query;
    const submission = await fetchCompanySubmission(cik);
    return {
      cik: submission.cik,
      entityType: submission.entityType,
      sic: submission.sic,
      sicDescription: submission.sicDescription,
      ownerOrg: submission.ownerOrg,
      tradingSymbol: submission.tradingSymbol || '',
    };
  } catch {
    return null;
  }
}

/**
 * Get recent filings for a company.
 * @param cik - Company CIK identifier
 * @param formTypes - Filter by specific form types (e.g., ['10-K', '10-Q'])
 * @returns Array of recent filings
 */
export async function getRecentFilings(
  cik: string,
  formTypes?: string[],
): Promise<SECFiling[]> {
  const submission = await fetchCompanySubmission(cik);
  let filings = submission.filings.recent;

  if (formTypes && formTypes.length > 0) {
    filings = filings.filter((f) => formTypes.includes(f.form));
  }

  return filings;
}

/**
 * Get Canadian companies traded on US exchanges.
 * @returns List of Canadian companies with US SEC filings
 */
export async function getCanadianCompanies(): Promise<Array<SECCompanyInfo & { ticker: string; exchange: string }>> {
  const url = `${SEC_API_BASE}/submissions/CIK0000000000.json`;

  const resp = await httpGet(url, {
    timeoutMs: SEC_TIMEOUT_MS,
    headers: {
      'User-Agent': SEC_USER_AGENT,
      'Accept': 'application/json',
    },
  });

  if (resp.statusCode >= 400) {
    throw new Error(`SEC API error: HTTP ${resp.statusCode}`);
  }

  const data = JSON.parse(resp.body) as SECSubmission;

  const canadian: Array<SECCompanyInfo & { ticker: string; exchange: string }> = [];

  for (const ticker of data.tickers) {
    if (ticker.endsWith('.TO') || ticker.endsWith('.V') || ticker.endsWith('-CN')) {
      const company = await searchCompany(ticker.replace(/\.(TO|V)|-CN$/, ''));
      if (company) {
        canadian.push({
          ...company,
          ticker,
          exchange: ticker.endsWith('.TO') ? 'TSX' : ticker.endsWith('.V') ? 'TSXV' : 'OTC',
        });
      }
    }
  }

  return canadian;
}

export interface GetRecentFilingsResult {
  cik: string;
  filings: SECFiling[];
  total: number;
}

export interface GetCanadianCompaniesResult {
  companies: Array<{
    cik: string;
    entityType: string;
    sic: string;
    sicDescription: string;
    ownerOrg: string;
    tradingSymbol: string;
    ticker: string;
    exchange: string;
  }>;
  total: number;
}