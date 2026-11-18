// SPDX-License-Identifier: AGPL-3.0-only
import { fetchCKANPackages } from "../gov-api.js";
import type { CKANPackage } from "../gov-api.js";

export async function ingestVancouvercouncil(): Promise<{ success: boolean; records: number }> {
  const packages = await fetchCKANPackages("https://ckan0.cf.opendata.inter.prod-toronto.ca", { query: "vancouver-council", rows: 5 });
  return { success: packages.length > 0, records: packages.length };
}

export async function searchVancouvercouncil(query: string): Promise<CKANPackage[]> {
  return fetchCKANPackages("https://ckan0.cf.opendata.inter.prod-toronto.ca", { query: "vancouver-council {{query}}", rows: 10 });
}
