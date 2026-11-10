// SPDX-License-Identifier: AGPL-3.0-only
import { fetchCKANPackages } from "../gov-api.js";
import type { CKANPackage } from "../gov-api.js";

export async function ingestTorontopolice(): Promise<{ success: boolean; records: number }> {
  const packages = await fetchCKANPackages("https://ckan0.cf.opendata.inter.prod-toronto.ca", { query: "toronto-police", rows: 5 });
  return { success: packages.length > 0, records: packages.length };
}

export async function searchTorontopolice(query: string): Promise<CKANPackage[]> {
  return fetchCKANPackages("https://ckan0.cf.opendata.inter.prod-toronto.ca", { query: "toronto-police {{query}}", rows: 10 });
}
