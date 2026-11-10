// SPDX-License-Identifier: AGPL-3.0-only
import { fetchCKANPackages } from "../gov-api.js";
import type { CKANPackage } from "../gov-api.js";

export async function ingestFederalgrants(): Promise<{ success: boolean; records: number }> {
  const packages = await fetchCKANPackages("https://open.canada.ca/data", { query: "federal-grants", rows: 5 });
  return { success: packages.length > 0, records: packages.length };
}

export async function searchFederalgrants(query: string): Promise<CKANPackage[]> {
  return fetchCKANPackages("https://open.canada.ca/data", { query: "federal-grants {{query}}", rows: 10 });
}
