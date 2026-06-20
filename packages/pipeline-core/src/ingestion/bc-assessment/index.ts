import { http } from "../../utils/http.js";

export async function ingestBCAssessment(): Promise<{ success: boolean; records: number }> {
  const resp = await http.get("https://www.bcassessment.ca/api/property");
  return { success: resp.ok, records: 0 };
}

export async function searchBCAssessment(query: string): Promise<any[]> {
  const resp = await http.get(`https://www.bcassessment.ca/api/search?q=${encodeURIComponent(query)}`);
  return resp.ok ? await resp.json() : [];
}
