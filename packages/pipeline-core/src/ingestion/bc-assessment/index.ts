// SPDX-License-Identifier: AGPL-3.0-only
import { fetchCKANPackages } from "../gov-api.js";
import type { CKANPackage } from "../gov-api.js";

const PORTAL = "https://catalogue.data.gov.bc.ca";
const DATASETS = ["bc-assessment-property-values-view", "bc-assessment-property-descriptions-view"];

export async function ingestBCAssessment(): Promise<{ success: boolean; records: number }> {
  let total = 0;
  for (const id of DATASETS) {
    const packages = await fetchCKANPackages(PORTAL, { query: id, rows: 1 });
    total += packages.length;
  }
  return { success: total > 0, records: total };
}

export async function searchBCAssessment(query: string): Promise<CKANPackage[]> {
  return fetchCKANPackages(PORTAL, { query: `assessment ${query}`, rows: 10 });
}
