// SPDX-License-Identifier: AGPL-3.0-only
import { fetchSocrataCatalog } from "../socrata-api.js";
import type { SocrataView } from "../socrata-api.js";

const ENDPOINT = "https://data.novascotia.ca";
const QUERY = "budget OR finance";

export async function ingestNsBudget(): Promise<{ success: boolean; records: number }> {
  const views = await fetchSocrataCatalog(ENDPOINT, { query: QUERY, limit: 20 });
  return { success: views.length > 0, records: views.length };
}

export async function searchNsBudget(query: string): Promise<SocrataView[]> {
  return fetchSocrataCatalog(ENDPOINT, { query: `${QUERY} ${query}`, limit: 10 });
}
