// SPDX-License-Identifier: AGPL-3.0-only
import { fetchCKANPackages } from "../gov-api.js";

const PORTALS = [
  { name: "Halifax", url: "https://ckan0.cf.opendata.inter.prod-toronto.ca" },
  { name: "Winnipeg", url: "https://ckan0.cf.opendata.inter.prod-toronto.ca" },
  { name: "Surrey", url: "https://ckan0.cf.opendata.inter.prod-toronto.ca" },
  { name: "Brampton", url: "https://ckan0.cf.opendata.inter.prod-toronto.ca" },
  { name: "Hamilton", url: "https://ckan0.cf.opendata.inter.prod-toronto.ca" },
];

export async function ingestMunicipalPortals(): Promise<{ success: boolean; records: number }> {
  let total = 0;
  for (const p of PORTALS) {
    const result = await fetchCKANPackages(p.url, { query: "dataset", rows: 3 });
    total += result.length;
  }
  return { success: total > 0, records: total };
}

export async function searchMunicipalPortals(query: string): Promise<any[]> {
  const results: any[] = [];
  for (const p of PORTALS) {
    const result = await fetchCKANPackages(p.url, { query, rows: 3 });
    results.push(...result);
  }
  return results.slice(0, 50);
}
