// SPDX-License-Identifier: AGPL-3.0-only
import { fetchCKANPackages } from "../gov-api.js";
import type { CKANPackage } from "../gov-api.js";

export async function ingestAbenergyregulator(): Promise<{ success: boolean; records: number }> {
  const packages = await fetchCKANPackages("https://catalogue.data.gov.bc.ca", { query: "ab-energy-regulator", rows: 5 });
  return { success: packages.length > 0, records: packages.length };
}

export async function searchAbenergyregulator(query: string): Promise<CKANPackage[]> {
  return fetchCKANPackages("https://catalogue.data.gov.bc.ca", { query: "ab-energy-regulator {{query}}", rows: 10 });
}
