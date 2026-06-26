import { fetchCKANPackages } from "../gov-api.js";
import type { CKANPackage } from "../gov-api.js";

const PORTAL = "https://data.gov.mb.ca";
const QUERY = "hydro";

export async function ingestMbHydro(): Promise<{ success: boolean; records: number }> {
  const packages = await fetchCKANPackages(PORTAL, { query: QUERY, rows: 20 });
  return { success: packages.length > 0, records: packages.length };
}

export async function searchMbHydro(query: string): Promise<CKANPackage[]> {
  return fetchCKANPackages(PORTAL, { query: `${QUERY} ${query}`, rows: 10 });
}
