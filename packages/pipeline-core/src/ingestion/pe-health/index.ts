// SPDX-License-Identifier: AGPL-3.0-only
// PEI uses ArcGIS Hub, NOT Socrata. The old Socrata endpoint (data.princeedwardisland.ca)
// returned nothing. Now using the ArcGIS REST API via fetchOpenDataPortal.
import { fetchOpenDataPortal, GOV_DATA_SOURCES } from "../gov-api.js";
import type { OpenDataPortalDataset } from "../gov-api.js";

const PEI_SOURCE = GOV_DATA_SOURCES.find((s) => s.name === "Prince Edward Island Open Data")!;
const QUERY = "health";

export async function ingestPeHealth(): Promise<{ success: boolean; records: number }> {
  const datasets = await fetchOpenDataPortal(PEI_SOURCE, { limit: 50 });
  const filtered = datasets.filter((d) =>
    `${d.title} ${d.description ?? ""}`.toLowerCase().includes(QUERY),
  );
  return { success: filtered.length > 0, records: filtered.length };
}

export async function searchPeHealth(query: string): Promise<OpenDataPortalDataset[]> {
  const datasets = await fetchOpenDataPortal(PEI_SOURCE, { limit: 50 });
  const q = `${QUERY} ${query}`.toLowerCase();
  return datasets
    .filter((d) => `${d.title} ${d.description ?? ""}`.toLowerCase().includes(q.split(/\s+/)[0]))
    .slice(0, 10);
}
