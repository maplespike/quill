// SPDX-License-Identifier: AGPL-3.0-only
// Northwest Territories — no CKAN API available (opendata.gov.nt.ca is dead).
// Using Pattern D: scrape the ECE Open Government Product HTML page for data links.
import { httpGet } from "../../utils/http.js";

const BASE = "https://www.ece.gov.nt.ca/en/services/open-government-product";

export interface NtOpenDataRecord {
  title: string;
  url: string | null;
}

/**
 * Parse the ECE Open Government Product HTML page to extract data file links
 * (CSV, XLS, XLSX, PDF) that are relevant to health or social services.
 */
function parseOgdLinks(html: string): NtOpenDataRecord[] {
  const records: NtOpenDataRecord[] = [];
  // Match <a href="..."> anchor tags pointing to downloadable data files
  const anchorPattern = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    if (!text) continue;

    // Only include downloadable data files
    if (!/\.(csv|xlsx?|pdf|zip|json|geojson|xml)(\?|$)/i.test(href)) continue;

    const fullUrl = href.startsWith("http")
      ? href
      : `https://www.ece.gov.nt.ca${href.startsWith("/") ? "" : "/"}${href}`;

    records.push({ title: text, url: fullUrl });
  }

  return records;
}

function filterByTopic(records: NtOpenDataRecord[], query: string): NtOpenDataRecord[] {
  const q = query.toLowerCase();
  const tokens = q.split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return records;
  return records.filter((r) => {
    const hay = r.title.toLowerCase();
    return tokens.some((t) => hay.includes(t));
  });
}

export async function ingestNtHealthSocial(): Promise<{ success: boolean; records: number }> {
  const resp = await httpGet(BASE, {
    timeoutMs: 15000,
    headers: { Accept: "text/html", "User-Agent": "MapleSpike/0.2 (+https://maplespike.lan)" },
  });
  if (resp.statusCode !== 200) return { success: false, records: 0 };
  try {
    const records = parseOgdLinks(resp.body);
    const filtered = filterByTopic(records, "health social");
    return { success: filtered.length > 0, records: filtered.length };
  } catch {
    return { success: false, records: 0 };
  }
}

export async function searchNtHealthSocial(query: string): Promise<NtOpenDataRecord[]> {
  const resp = await httpGet(BASE, {
    timeoutMs: 15000,
    headers: { Accept: "text/html", "User-Agent": "MapleSpike/0.2 (+https://maplespike.lan)" },
  });
  if (resp.statusCode !== 200) return [];
  try {
    const records = parseOgdLinks(resp.body);
    return filterByTopic(records, query).slice(0, 10);
  } catch {
    return [];
  }
}
