// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from "../../utils/http.js";

const BASE = "https://opendata.gov.nl.ca";

export async function ingestNlBudget(): Promise<{ success: boolean; records: number }> {
  const resp = await httpGet(`${BASE}/api/3/action/package_search?q=budget OR finance&rows=20`, {
    timeoutMs: 15000,
    headers: { Accept: "application/json" },
  });
  if (resp.statusCode !== 200) return { success: false, records: 0 };
  try {
    const data: any = await resp.json();
    const count = data?.result?.results?.length ?? 0;
    return { success: count > 0, records: count };
  } catch {
    return { success: false, records: 0 };
  }
}

export async function searchNlBudget(query: string): Promise<Array<{ title: string; url: string | null }>> {
  const resp = await httpGet(`${BASE}/api/3/action/package_search?q=budget ${encodeURIComponent(query)}&rows=10`, {
    timeoutMs: 15000,
    headers: { Accept: "application/json" },
  });
  if (resp.statusCode !== 200) return [];
  try {
    const data: any = await resp.json();
    return (data?.result?.results ?? []).map((r: any) => ({
      title: r.title ?? "Untitled",
      url: r.resources?.[0]?.url ?? null,
    }));
  } catch {
    return [];
  }
}
