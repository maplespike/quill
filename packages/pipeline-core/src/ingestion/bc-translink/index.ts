// SPDX-License-Identifier: AGPL-3.0-only
import { fetchCKANPackages } from "../gov-api.js";
import type { CKANPackage } from "../gov-api.js";

export async function ingestBctranslink(): Promise<{ success: boolean; records: number }> {
  const packages = await fetchCKANPackages("https://catalogue.data.gov.bc.ca", { query: "bc-translink", rows: 5 });
  return { success: packages.length > 0, records: packages.length };
}

export async function searchBctranslink(query: string): Promise<CKANPackage[]> {
  return fetchCKANPackages("https://catalogue.data.gov.bc.ca", { query: "bc-translink {{query}}", rows: 10 });
}
