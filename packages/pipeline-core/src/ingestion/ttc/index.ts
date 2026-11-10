// SPDX-License-Identifier: AGPL-3.0-only
import { fetchCKANPackages } from "../gov-api.js";
import type { CKANPackage } from "../gov-api.js";

const PORTAL = "https://ckan0.cf.opendata.inter.prod-toronto.ca";
const DATASETS = [
  "ttc-bus-delay-data",
  "ttc-streetcar-delay-data", 
  "ttc-subway-delay-data"
];

export async function ingestTTC(): Promise<{ success: boolean; records: number }> {
  let total = 0;
  for (const id of DATASETS) {
    const packages = await fetchCKANPackages(PORTAL, { query: id, rows: 1 });
    total += packages.length;
  }
  return { success: total > 0, records: total };
}

export async function searchTTC(query: string): Promise<CKANPackage[]> {
  return fetchCKANPackages(PORTAL, { query: `ttc ${query}`, rows: 10 });
}
