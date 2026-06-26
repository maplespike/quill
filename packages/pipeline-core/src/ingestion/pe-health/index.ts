import { fetchSocrataCatalog } from "../socrata-api.js";
import type { SocrataView } from "../socrata-api.js";

const ENDPOINT = "https://data.princeedwardisland.ca";
const QUERY = "health";

export async function ingestPeHealth(): Promise<{ success: boolean; records: number }> {
  const views = await fetchSocrataCatalog(ENDPOINT, { query: QUERY, limit: 20 });
  return { success: views.length > 0, records: views.length };
}

export async function searchPeHealth(query: string): Promise<SocrataView[]> {
  return fetchSocrataCatalog(ENDPOINT, { query: `${QUERY} ${query}`, limit: 10 });
}
