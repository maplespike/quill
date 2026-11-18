// SPDX-License-Identifier: AGPL-3.0-only
import { fetchSocrataCatalog } from "../socrata-api.js";
import type { SocrataView } from "../socrata-api.js";

const ENDPOINT = "https://data.edmonton.ca";
const QUERY = "transit ETS bus LRT schedule";

export async function ingestEdmontonTransit(): Promise<{ success: boolean; records: number }> {
  const views = await fetchSocrataCatalog(ENDPOINT, { query: QUERY, limit: 20 });
  return { success: views.length > 0, records: views.length };
}

export async function searchEdmontonTransit(query: string): Promise<SocrataView[]> {
  return fetchSocrataCatalog(ENDPOINT, { query: `${QUERY} ${query}`, limit: 10 });
}
