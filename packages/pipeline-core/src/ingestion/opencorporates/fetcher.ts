// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../utils/http.js';
import { OC_API_BASE, OC_TIMEOUT_MS, OC_UA, OC_REQ_INTERVAL_MS } from './constants.js';
import type { OCCompany, OCOfficer, OCFiling, OCRelationship, OCSearchResult } from './types.js';

const ATTR = { source: 'OpenCorporates', license: "The publisher's current terms were not verified for this dataset and access plan; consult OpenCorporates terms", attribution: 'Data from OpenCorporates (opencorporates.com)' };

let lastReq = 0;
async function rateLimitedFetch(url: string): Promise<any> {
  const now = Date.now();
  const wait = Math.max(0, OC_REQ_INTERVAL_MS - (now - lastReq));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastReq = Date.now();
  try {
    const resp = await httpGet(url, { timeoutMs: OC_TIMEOUT_MS, headers: { 'User-Agent': OC_UA, Accept: 'application/json' } });
    if (resp.statusCode >= 400) return null;
    return JSON.parse(resp.body);
  } catch { return null; }
}

function apiKey(): string {
  return process.env['OPENCORPORATES_API_KEY'] || '';
}

export async function searchCompanies(query: string, jurisdiction?: string): Promise<OCSearchResult> {
  const key = apiKey();
  if (!key) return { results: [], total: 0, page: 1, ...ATTR };
  const jur = jurisdiction ? `&jurisdiction_code=${jurisdiction}` : '&jurisdiction_code=ca';
  const data = await rateLimitedFetch(`${OC_API_BASE}/companies/search?q=${encodeURIComponent(query)}${jur}&api_token=${key}`);
  const companies = data?.results?.companies ?? [];
  return {
    results: companies.map((c: any) => ({
      name: c.company?.name || '', companyNumber: c.company?.company_number || '',
      jurisdictionCode: c.company?.jurisdiction_code || 'ca',
      incorporationDate: c.company?.incorporation_date || undefined,
      companyType: c.company?.company_type || undefined,
      status: c.company?.current_status || undefined,
      url: c.company?.opencorporates_url || '',
    })),
    total: data?.results?.total_count ?? companies.length,
    page: 1, ...ATTR,
  };
}

export async function getCompany(jurisdictionCode: string, companyNumber: string): Promise<{ company?: OCCompany } & typeof ATTR> {
  const key = apiKey();
  if (!key) return { company: undefined, ...ATTR };
  const data = await rateLimitedFetch(`${OC_API_BASE}/companies/${jurisdictionCode}/${companyNumber}?api_token=${key}`);
  const c = data?.results?.company;
  if (!c) return { company: undefined, ...ATTR };
  return { company: { name: c.name, companyNumber: c.company_number, jurisdictionCode, incorporationDate: c.incorporation_date, companyType: c.company_type, status: c.current_status, url: c.opencorporates_url }, ...ATTR };
}

export async function getOfficers(jurisdictionCode: string, companyNumber: string): Promise<{ officers: OCOfficer[] } & typeof ATTR> {
  const key = apiKey();
  if (!key) return { officers: [], ...ATTR };
  const data = await rateLimitedFetch(`${OC_API_BASE}/companies/${jurisdictionCode}/${companyNumber}/officers?api_token=${key}`);
  return {
    officers: (data?.results?.officers ?? []).map((o: any) => ({
      name: o.officer?.name || '', position: o.officer?.position || '',
      startDate: o.officer?.start_date || undefined, endDate: o.officer?.end_date || undefined,
    })),
    ...ATTR,
  };
}

export async function getCorporateGroupings(jurisdictionCode: string, companyNumber: string): Promise<{ relationships: OCRelationship[] } & typeof ATTR> {
  const key = apiKey();
  if (!key) return { relationships: [], ...ATTR };
  const data = await rateLimitedFetch(`${OC_API_BASE}/companies/${jurisdictionCode}/${companyNumber}/corporate_groupings?api_token=${key}`);
  return {
    relationships: (data?.results?.relationships ?? []).map((r: any) => ({
      type: r.relationship?.type || '', companyName: r.relationship?.company?.name || '',
      companyNumber: r.relationship?.company?.company_number || '',
      jurisdictionCode: r.relationship?.company?.jurisdiction_code || '',
    })),
    ...ATTR,
  };
}

export async function getFilings(jurisdictionCode: string, companyNumber: string): Promise<{ filings: OCFiling[] } & typeof ATTR> {
  const key = apiKey();
  if (!key) return { filings: [], ...ATTR };
  const data = await rateLimitedFetch(`${OC_API_BASE}/companies/${jurisdictionCode}/${companyNumber}/filings?api_token=${key}`);
  return {
    filings: (data?.results?.filings ?? []).map((f: any) => ({
      title: f.filing?.title || '', date: f.filing?.date || undefined,
      filingType: f.filing?.filing_type?.name || undefined, url: f.filing?.opencorporates_url || undefined,
    })),
    ...ATTR,
  };
}

export async function getCompanyByCorporationNumber(corpNumber: string): Promise<{ company?: OCCompany } & typeof ATTR> {
  // Try federal first, then common provinces
  for (const jur of ['ca', 'ca_on', 'ca_bc', 'ca_ab', 'ca_qc']) {
    const result = await getCompany(jur, corpNumber);
    if (result.company) return result;
  }
  return { company: undefined, ...ATTR };
}
