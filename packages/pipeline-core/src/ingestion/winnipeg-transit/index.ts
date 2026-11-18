// SPDX-License-Identifier: AGPL-3.0-only
import { fetchSocrataCatalog } from "../socrata-api.js";
import type { SocrataView } from "../socrata-api.js";

const ENDPOINT = "https://data.winnipeg.ca";
const QUERY = "transit bus schedule route";

export async function ingestWinnipegTransit(): Promise<{ success: boolean; records: number }> {
  const views = await fetchSocrataCatalog(ENDPOINT, { query: QUERY, limit: 20 });
  return { success: views.length > 0, records: views.length };
}

export async function searchWinnipegTransit(query: string): Promise<SocrataView[]> {
  return fetchSocrataCatalog(ENDPOINT, { query: `${QUERY} ${query}`, limit: 10 });
}
