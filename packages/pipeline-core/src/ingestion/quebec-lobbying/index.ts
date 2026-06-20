import { http } from "../../utils/http.js";

export async function ingestQuebecLobbying(): Promise<{ success: boolean; records: number }> {
  const resp = await http.get("https://lobby.quebec/api/registrations");
  return { success: resp.ok, records: 0 };
}

export async function searchQuebecLobbying(query: string): Promise<any[]> {
  const resp = await http.get(`https://lobby.quebec/api/search?q=${encodeURIComponent(query)}`);
  return resp.ok ? await resp.json() : [];
}
