// SPDX-License-Identifier: AGPL-3.0-only
import { fetchCKANPackages } from "../gov-api.js";
import type { CKANPackage } from "../gov-api.js";

export async function ingestTorontobuildingpermits(): Promise<{ success: boolean; records: number }> {
  const packages = await fetchCKANPackages("https://ckan0.cf.opendata.inter.prod-toronto.ca", { query: "toronto-building-permits", rows: 5 });
  return { success: packages.length > 0, records: packages.length };
}

export async function searchTorontobuildingpermits(query: string): Promise<CKANPackage[]> {
  return fetchCKANPackages("https://ckan0.cf.opendata.inter.prod-toronto.ca", { query: "toronto-building-permits {{query}}", rows: 10 });
}
