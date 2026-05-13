/**
 * Provincial CKAN Portal Stubs — Frostbite Data Pipeline
 *
 * Convenience wrappers around fetchCKANPackages for the 9 Canadian
 * provincial/territorial CKAN portals added to GOV_DATA_SOURCES.
 *
 * Each province code maps to a known CKAN endpoint so callers can
 * fetch datasets without remembering the full URL.
 */

import { fetchCKANPackages } from './gov-api.js';
import type { CKANPackage } from './gov-api.js';

/* ------------------------------------------------------------------ */
/*  Source Map                                                        */
/* ------------------------------------------------------------------ */

export interface ProvincialCkanSource {
  name: string;
  jurisdiction: string;
  endpoint: string;
  notes: string;
}

/**
 * Index of provincial/territorial CKAN portals by 2-letter code.
 *
 * Codes follow Canada Post / ISO 3166-2:CA abbreviations:
 *   SK, MB, NS, NB, NL, PE  — provinces
 *   NT, NU, YT               — territories
 */
export const PROVINCIAL_CKAN_SOURCES: Record<string, ProvincialCkanSource> = {
  SK: {
    name: 'Saskatchewan Open Data',
    jurisdiction: 'saskatchewan',
    endpoint: 'https://data.saskatchewan.ca',
    notes: 'Provincial CKAN portal',
  },
  MB: {
    name: 'Manitoba Open Data',
    jurisdiction: 'manitoba',
    endpoint: 'https://data.gov.mb.ca',
    notes: 'Provincial CKAN portal',
  },
  NS: {
    name: 'Nova Scotia Open Data',
    jurisdiction: 'nova-scotia',
    endpoint: 'https://data.novascotia.ca',
    notes: 'Provincial CKAN portal',
  },
  NB: {
    name: 'New Brunswick Open Data',
    jurisdiction: 'new-brunswick',
    endpoint: 'https://data.gnb.ca',
    notes: 'Provincial CKAN portal',
  },
  NL: {
    name: 'Newfoundland & Labrador Open Data',
    jurisdiction: 'newfoundland',
    endpoint: 'https://data.gov.nl.ca',
    notes: 'Provincial CKAN portal',
  },
  PE: {
    name: 'Prince Edward Island Open Data',
    jurisdiction: 'pei',
    endpoint: 'https://data.princeedwardisland.ca',
    notes: 'Provincial CKAN portal',
  },
  NT: {
    name: 'NWT Open Data',
    jurisdiction: 'northwest-territories',
    endpoint: 'https://www.gov.nt.ca/data',
    notes: 'Territorial CKAN portal',
  },
  NU: {
    name: 'Nunavut Open Data',
    jurisdiction: 'nunavut',
    endpoint: 'https://data.gov.nu.ca',
    notes: 'Territorial CKAN portal',
  },
  YT: {
    name: 'Yukon Open Data',
    jurisdiction: 'yukon',
    endpoint: 'https://data.yukon.ca',
    notes: 'Territorial CKAN portal',
  },
};

/* ------------------------------------------------------------------ */
/*  Single-province fetcher                                            */
/* ------------------------------------------------------------------ */

/**
 * Fetch packages from a specific provincial CKAN portal.
 *
 * @param provinceCode  Two-letter code (SK, MB, NS, NB, NL, PE, NT, NU, YT)
 * @param query         Optional search query (maps to CKAN `q` parameter)
 * @returns             Array of CKANPackage objects, or empty on error/timeout
 */
export async function fetchProvincialCkan(
  provinceCode: string,
  query?: string,
): Promise<CKANPackage[]> {
  const code = provinceCode.toUpperCase();
  const source = PROVINCIAL_CKAN_SOURCES[code];

  if (!source) {
    console.warn(`Unknown provincial CKAN code: ${provinceCode}`);
    return [];
  }

  return fetchCKANPackages(source.endpoint, { rows: 20, query });
}

/* ------------------------------------------------------------------ */
/*  All-provinces fetcher                                              */
/* ------------------------------------------------------------------ */

/**
 * Fetch packages from every known provincial CKAN portal.
 *
 * @param query  Optional search query passed to every portal
 * @returns      Record mapping province code → CKANPackage[]
 */
export async function fetchAllProvincialCkan(
  query?: string,
): Promise<Record<string, CKANPackage[]>> {
  const results: Record<string, CKANPackage[]> = {};

  const codes = Object.keys(PROVINCIAL_CKAN_SOURCES);
  const fetches = codes.map(async (code) => {
    try {
      results[code] = await fetchProvincialCkan(code, query);
    } catch (error) {
      console.error(
        `fetchAllProvincialCkan: ${code} failed:`,
        (error as Error).message,
      );
      results[code] = [];
    }
  });

  await Promise.all(fetches);
  return results;
}
