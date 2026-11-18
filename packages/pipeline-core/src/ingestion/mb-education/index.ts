// SPDX-License-Identifier: AGPL-3.0-only
// Manitoba provincial portal decommissioned — using federal CKAN fallback
// data.gov.mb.ca is DEAD (DNS removed); opendata.manitoba.ca DNS removed.
import { fetchCKANPackages } from "../gov-api.js";
import type { CKANPackage } from "../gov-api.js";

const PORTAL = "https://open.canada.ca/data/api/3/action";
const QUERY = "manitoba education";

export async function ingestMbEducation(): Promise<{ success: boolean; records: number }> {
  const packages = await fetchCKANPackages(PORTAL, { query: QUERY, rows: 20 });
  return { success: packages.length > 0, records: packages.length };
}

export async function searchMbEducation(query: string): Promise<CKANPackage[]> {
  return fetchCKANPackages(PORTAL, { query: `manitoba ${query}`, rows: 10 });
}
