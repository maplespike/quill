// SPDX-License-Identifier: AGPL-3.0-only
import { fetchCKANPackages } from "../gov-api.js";
import type { CKANPackage } from "../gov-api.js";

const PORTAL = "https://open.canada.ca/data/api/3/action";
const QUERY = "land claims self-government agreement indigenous";

export async function ingestIndigenousLandClaims(): Promise<{ success: boolean; records: number }> {
  const packages = await fetchCKANPackages(PORTAL, { query: QUERY, rows: 20 });
  return { success: packages.length > 0, records: packages.length };
}

export async function searchIndigenousLandClaims(query: string): Promise<CKANPackage[]> {
  return fetchCKANPackages(PORTAL, { query: `${QUERY} ${query}`, rows: 10 });
}
