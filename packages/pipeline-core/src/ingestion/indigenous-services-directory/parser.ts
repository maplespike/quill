// SPDX-License-Identifier: AGPL-3.0-only
import { computeHash } from '../../verification/hashing.js';
import type { ParsedServiceRecord, ServiceRecord } from './types.js';

export function normalizeProvince(province: string | null): string {
  if (!province) return 'CA';

  const prov = province.toUpperCase().trim();
  const CODE_SET = new Set(['AB', 'BC', 'MB', 'NB', 'NL', 'NT', 'NS', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']);
  if (CODE_SET.has(prov)) return prov;
  const map: Record<string, string> = {
    'ALBERTA': 'AB',
    'BRITISH COLUMBIA': 'BC',
    'MANITOBA': 'MB',
    'NEW BRUNSWICK': 'NB',
    'NEWFOUNDLAND': 'NL',
    'NEWFOUNDLAND AND LABRADOR': 'NL',
    'NORTHWEST TERRITORIES': 'NT',
    'NOVA SCOTIA': 'NS',
    'NUNAVUT': 'NU',
    'ONTARIO': 'ON',
    'PRINCE EDWARD ISLAND': 'PE',
    'QUEBEC': 'QC',
    'SASKATCHEWAN': 'SK',
    'YUKON': 'YT',
  };

  return map[prov] || 'CA';
}

export async function parseIndigenousServicesDirectory(
  data: string
): Promise<ParsedServiceRecord[]> {
  if (!data || data.trim() === '') {
    return [];
  }

  let rawRecords: unknown[];

  try {
    rawRecords = JSON.parse(data) as unknown[];
  } catch {
    return [];
  }

  if (!Array.isArray(rawRecords)) {
    return [];
  }

  const parsed: ParsedServiceRecord[] = [];

  for (const raw of rawRecords) {
    if (typeof raw !== 'object' || raw === null) {
      continue;
    }

    const rec = raw as Record<string, unknown>;

    const name = rec.name ? String(rec.name).trim() : '';
    if (!name) {
      continue; // Filter out records without a service name
    }

    const organization = rec.organization ? String(rec.organization).trim() : '';
    const province = normalizeProvince(rec.province ? String(rec.province) : null);
    const url = rec.url ? String(rec.url).trim() : undefined;
    const category = rec.category ? String(rec.category).trim() : undefined;

    const citation_string = `${organization}|${name}|${province}`;
    const citation_hash = await computeHash(citation_string);

    parsed.push({
      id: citation_hash,
      organization,
      name,
      province,
      url,
      category,
      trust_score: 80,
      citation_hash,
    });
  }

  return parsed;
}

export function filterServiceRecords(
  records: ParsedServiceRecord[],
  options: { province?: string; category?: string }
): ParsedServiceRecord[] {
  return records.filter((rec) => {
    if (options.province && rec.province !== options.province) {
      return false;
    }
    if (options.category && rec.category !== options.category) {
      return false;
    }
    return true;
  });
}