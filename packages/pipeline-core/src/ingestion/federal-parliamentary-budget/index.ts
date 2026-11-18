// SPDX-License-Identifier: AGPL-3.0-only
import { fetchCKANPackages } from "../gov-api.js";
import type { CKANPackage } from "../gov-api.js";

export async function ingestFederalparliamentarybudget(): Promise<{ success: boolean; records: number }> {
  const packages = await fetchCKANPackages("https://open.canada.ca/data", { query: "federal-parliamentary-budget", rows: 5 });
  return { success: packages.length > 0, records: packages.length };
}

export async function searchFederalparliamentarybudget(query: string): Promise<CKANPackage[]> {
  return fetchCKANPackages("https://open.canada.ca/data", { query: "federal-parliamentary-budget {{query}}", rows: 10 });
}
