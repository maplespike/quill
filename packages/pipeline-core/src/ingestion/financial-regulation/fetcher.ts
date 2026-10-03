import { httpGet } from '../../utils/http.js';
import { FINREG_CKAN, FINREG_TIMEOUT_MS, FINREG_UA } from './constants.js';
import type { FinRegRecord, FinRegIngestionResult } from './types.js';

async function searchCkan(query: string, rows = 10) {
  try {
    const resp = await httpGet(`${FINREG_CKAN}?q=${encodeURIComponent(query)}&rows=${rows}`, {
      timeoutMs: FINREG_TIMEOUT_MS,
      headers: { 'User-Agent': FINREG_UA },
    });
    if (resp.statusCode >= 400) return [];
    const data = JSON.parse(resp.body);
    return (data?.result?.results ?? []).map((r: any) => ({
      id: r.id, title: r.title || '', description: (r.notes || '').substring(0, 300),
      url: `https://open.canada.ca/data/en/dataset/${r.id}`,
      date: r.metadata_created?.substring(0, 10) || '',
      license: r.license,
      license_id: r.license_id,
      license_title: r.license_title,
      license_url: r.license_url,
      attribution: r.attribution,
    }));
  } catch { return []; }
}

export async function ingestOSFI(): Promise<FinRegIngestionResult> {
  const start = Date.now();
  const results = await searchCkan('osfi financial institutions', 10);
  return {
    source: 'osfi', recordsFound: results.length,
    records: results.map((r: any) => ({ ...r, regulator: 'OSFI', category: 'financial-regulation', jurisdiction: 'federal' })),
    errors: [], durationMs: Date.now() - start,
  };
}

export async function ingestCDIC(): Promise<FinRegIngestionResult> {
  const start = Date.now();
  const results = await searchCkan('cdic deposit insurance', 10);
  return {
    source: 'cdic', recordsFound: results.length,
    records: results.map((r: any) => ({ ...r, regulator: 'CDIC', category: 'deposit-insurance', jurisdiction: 'federal' })),
    errors: [], durationMs: Date.now() - start,
  };
}

export async function ingestFCAC(): Promise<FinRegIngestionResult> {
  const start = Date.now();
  const results = await searchCkan('fcac banking complaints consumer', 10);
  return {
    source: 'fcac', recordsFound: results.length,
    records: results.map((r: any) => ({ ...r, regulator: 'FCAC', category: 'consumer-protection', jurisdiction: 'federal' })),
    errors: [], durationMs: Date.now() - start,
  };
}

export async function ingestCSA(): Promise<FinRegIngestionResult> {
  const start = Date.now();
  const results = await searchCkan('securities regulation canada', 10);
  return {
    source: 'csa', recordsFound: results.length,
    records: results.map((r: any) => ({ ...r, regulator: 'CSA', category: 'securities-regulation', jurisdiction: 'federal-provincial' })),
    errors: [], durationMs: Date.now() - start,
  };
}

export async function ingestOBSI(): Promise<FinRegIngestionResult> {
  const start = Date.now();
  const results = await searchCkan('banking ombudsman complaints', 10);
  return {
    source: 'obsi', recordsFound: results.length,
    records: results.map((r: any) => ({ ...r, regulator: 'OBSI', category: 'banking-ombudsman', jurisdiction: 'federal' })),
    errors: [], durationMs: Date.now() - start,
  };
}

export async function ingestAllFinancialRegulation(): Promise<Record<string, FinRegIngestionResult>> {
  const [osfi, cdic, fcac, csa, obsi] = await Promise.all([ingestOSFI(), ingestCDIC(), ingestFCAC(), ingestCSA(), ingestOBSI()]);
  return { osfi, cdic, fcac, csa, obsi };
}
