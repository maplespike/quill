import { http } from "../../utils/http.js";

export async function ingestTorontoTTC(): Promise<{ success: boolean; records: number }> {
  const resp = await http.get("https://www.ttc.ca/api/gtfs");
  return { success: resp.ok, records: 0 };
}

export async function searchTorontoTTC(query: string): Promise<any[]> {
  const resp = await http.get(`https://www.ttc.ca/api/gtfs/search?q=${encodeURIComponent(query)}`);
  return resp.ok ? await resp.json() : [];
}
