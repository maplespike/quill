// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from "../../utils/http.js";

const BASE = "https://lobbyist.oico.on.ca";

export async function ingestOntarioLobbying(): Promise<{ success: boolean; records: number }> {
  const resp = await httpGet(`${BASE}/search?query=lobbyist`, { timeoutMs: 10000 });
  if (resp.statusCode !== 200) return { success: false, records: 0 };
  const count = (resp.body.match(/class="result-item"/gi) || []).length;
  return { success: count > 0, records: count };
}

export async function searchOntarioLobbying(query: string): Promise<Array<{ title: string; url: string }>> {
  const resp = await httpGet(`${BASE}/search?query=${encodeURIComponent(query)}`, { timeoutMs: 10000 });
  if (resp.statusCode !== 200) return [];
  const results: Array<{ title: string; url: string }> = [];
  const titleRegex = /<a[^>]*class="result-title"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
  let m;
  while ((m = titleRegex.exec(resp.body)) !== null) {
    results.push({ title: m[2].trim(), url: BASE + m[1] });
  }
  return results.slice(0, 20);
}
