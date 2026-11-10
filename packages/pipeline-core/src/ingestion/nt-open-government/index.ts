// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from "../../utils/http.js";

// NWT Open Government Product — no CKAN/API available
// Published as static HTML pages on department websites
// ece.gov.nt.ca is accessible (no Cloudflare)

const BASE = "https://www.ece.gov.nt.ca";

/**
 * Ingest NWT Open Government Product page.
 * No API — checks page accessibility and counts referenced data products.
 */
export async function ingestNtOpenGovernment(): Promise<{ success: boolean; records: number }> {
  const resp = await httpGet(`${BASE}/en/services/open-government-product`, { timeoutMs: 10000 });
  if (resp.statusCode !== 200) return { success: false, records: 0 };

  // Count data product references in the HTML
  const dataMatches = resp.body.match(/(?:download|product|dataset|\.xlsx|\.csv|\.pdf)/gi) || [];
  return { success: true, records: Math.min(dataMatches.length, 50) };
}

/**
 * Search NWT government pages for data products.
 */
export async function searchNtOpenGovernment(query: string): Promise<Array<{ title: string; url: string }>> {
  const resp = await httpGet(`${BASE}/en/services/open-government-product`, { timeoutMs: 10000 });
  if (resp.statusCode !== 200) return [];

  const results: Array<{ title: string; url: string }> = [];
  const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
  let m;
  while ((m = linkRegex.exec(resp.body)) !== null) {
    const text = m[2].trim().toLowerCase();
    if (text.includes(query.toLowerCase()) || m[1].toLowerCase().includes(query.toLowerCase())) {
      const url = m[1].startsWith("http") ? m[1] : `${BASE}${m[1]}`;
      results.push({ title: m[2].trim(), url });
    }
  }
  return results.slice(0, 20);
}
