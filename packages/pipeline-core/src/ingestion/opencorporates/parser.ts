// SPDX-License-Identifier: AGPL-3.0-only
import { computeHash } from '../../verification/hashing.js';
import { OC_JURISDICTIONS } from './constants.js';
import type { OCCompany, OCOfficer, OCFiling } from './types.js';

export function normalizeJurisdiction(code: string): string {
  return OC_JURISDICTIONS[code] || code;
}

export async function parseCompanyRecord(raw: Record<string, unknown>): Promise<OCCompany | null> {
  try {
    const name = String(raw.name || raw.Name || '');
    if (!name) return null;
    const content = JSON.stringify({ name, companyNumber: raw.companyNumber, jurisdictionCode: raw.jurisdictionCode });
    const id = await computeHash(`oc-company:${content}`);
    return {
      name, companyNumber: String(raw.companyNumber || raw.CompanyNumber || '' || id),
      jurisdictionCode: String(raw.jurisdictionCode || raw.JurisdictionCode || 'ca'),
      incorporationDate: String(raw.incorporationDate || raw.IncorporationDate || '') || undefined,
      companyType: String(raw.companyType || raw.CompanyType || '') || undefined,
      status: String(raw.status || raw.Status || '') || undefined,
      address: String(raw.address || raw.Address || '') || undefined,
      url: String(raw.url || raw.Url || '') || '',
    };
  } catch (err) {
    console.warn(`[OC Parser] Skipping company: ${(err as Error).message}`);
    return null;
  }
}

export async function parseOfficerRecord(raw: Record<string, unknown>): Promise<OCOfficer | null> {
  try {
    const name = String(raw.name || raw.Name || '');
    if (!name) return null;
    return {
      name,
      position: String(raw.position || raw.Position || ''),
      startDate: String(raw.startDate || raw.StartDate || '') || undefined,
      endDate: String(raw.endDate || raw.EndDate || '') || undefined,
    };
  } catch (err) {
    console.warn(`[OC Parser] Skipping officer: ${(err as Error).message}`);
    return null;
  }
}

export async function parseFilingRecord(raw: Record<string, unknown>): Promise<OCFiling | null> {
  try {
    const title = String(raw.title || raw.Title || '');
    if (!title) return null;
    return {
      title,
      date: String(raw.date || raw.Date || '') || undefined,
      filingType: String(raw.filingType || raw.FilingType || '') || undefined,
      url: String(raw.url || raw.Url || '') || undefined,
    };
  } catch (err) {
    console.warn(`[OC Parser] Skipping filing: ${(err as Error).message}`);
    return null;
  }
}

export async function parseOpenCorporatesRecords(
  rawRecords: Record<string, unknown>[],
  recordType: 'company' | 'officer' | 'filing',
): Promise<any[]> {
  const results: any[] = [];
  const seenHashes = new Set<string>();
  for (const raw of rawRecords) {
    let parsed: any = null;
    if (recordType === 'company') parsed = await parseCompanyRecord(raw);
    else if (recordType === 'officer') parsed = await parseOfficerRecord(raw);
    else if (recordType === 'filing') parsed = await parseFilingRecord(raw);
    if (parsed) {
      const hc = JSON.stringify(parsed);
      const h = await computeHash(`oc-${recordType}:${hc}`);
      if (!seenHashes.has(h)) {
        seenHashes.add(h);
        results.push(parsed);
      }
    }
  }
  return results;
}
