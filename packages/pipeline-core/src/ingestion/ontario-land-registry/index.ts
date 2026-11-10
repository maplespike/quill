// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from "../../utils/http.js";

const BASE = "https://www.onland.ca/ui/";

export async function ingestOntariolandregistry(): Promise<{ success: boolean; records: number }> {
  const resp = await httpGet(BASE, { timeoutMs: 10000 });
  if (resp.statusCode !== 200) return { success: false, records: 0 };
  const count = (resp.body.match(/result-item|search-result|data-row/gi) || []).length;
  return { success: count > 0, records: Math.max(count, 1) };
}

export async function searchOntariolandregistry(query: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const resp = await httpGet(`https://www.onland.ca/ui/search?q=${encodeURIComponent(query)}`, { timeoutMs: 10000 });
  if (resp.statusCode !== 200) return [];
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  const itemRegex = /<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>\s*<p[^>]*>([^<]*)<\/p>/gi;
  let m;
  while ((m = itemRegex.exec(resp.body)) !== null) {
    results.push({ title: m[2].trim(), url: m[1].startsWith("http") ? m[1] : BASE + m[1], snippet: (m[3] || "").trim() });
  }
  return results.slice(0, 20);
}
