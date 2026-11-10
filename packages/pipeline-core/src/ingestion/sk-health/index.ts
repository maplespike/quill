// SPDX-License-Identifier: AGPL-3.0-only
// Saskatchewan provincial portal decommissioned — using federal CKAN fallback
// data.saskatchewan.ca is DEAD (DNS removed); dashboard.saskatchewan.ca has no CKAN API.
import { fetchCKANPackages } from "../gov-api.js";
import type { CKANPackage } from "../gov-api.js";

const PORTAL = "https://open.canada.ca/data/api/3/action";
const QUERY = "saskatchewan health";

export async function ingestSkHealth(): Promise<{ success: boolean; records: number }> {
  const packages = await fetchCKANPackages(PORTAL, { query: QUERY, rows: 20 });
  return { success: packages.length > 0, records: packages.length };
}

export async function searchSkHealth(query: string): Promise<CKANPackage[]> {
  return fetchCKANPackages(PORTAL, { query: `saskatchewan ${query}`, rows: 10 });
}
