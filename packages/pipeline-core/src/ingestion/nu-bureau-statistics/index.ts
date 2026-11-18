// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from "../../utils/http.js";

// Nunavut Bureau of Statistics — no CKAN/API available
// Data files published at https://www.gov.nu.ca/sites/default/files/documents/
// Cloudflare protects HTML pages but NOT direct file downloads
// Bureau contact: statsbureau@gov.nu.ca

const BASE = "https://www.gov.nu.ca";
const BUREAU_PAGE = "/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics";

// Known data file patterns (confirmed downloadable 2026-07-01)
const KNOWN_DATA_FILES = [
  { path: "/sites/default/files/documents/2025-03/Nunavut_Deaths_by_Sex__Age_Group__Marital_Status_and_by_Month__2007_to_2023__4_tables_.xlsx", category: "demographics" },
  { path: "/sites/default/files/documents/2024-09/Nunavut_Population_Estimates_by_Marital_Status_and_Age_Groups_2005_to_2022_Dissemination_file.xlsx", category: "population" },
  { path: "/sites/default/files/documents/2022-11/nunavut_secondary_school_graduates_1999_to_2018_2_tables.xlsx", category: "education" },
  { path: "/sites/default/files/documents/2025-04/Consumer_Price_Index_Report__March_2025.pdf", category: "economic" },
];

export interface NunavutDataset {
  title: string;
  url: string;
  category: string;
  format: string;
}

/**
 * Ingest Nunavut Bureau of Statistics data.
 * Uses direct file download — no API exists.
 * HTML pages are Cloudflare-protected but data files are not.
 */
export async function ingestNuBureauStatistics(): Promise<{ success: boolean; records: number }> {
  let accessible = 0;
  for (const file of KNOWN_DATA_FILES) {
    try {
      const resp = await httpGet(`${BASE}${file.path}`, { timeoutMs: 10000 });
      if (resp.statusCode === 200) accessible++;
    } catch {
      // File may have been moved or renamed
    }
  }
  return { success: accessible > 0, records: accessible };
}

/**
 * Search Nunavut data by keyword against known file catalog.
 */
export async function searchNuBureauStatistics(query: string): Promise<NunavutDataset[]> {
  const q = query.toLowerCase();
  return KNOWN_DATA_FILES
    .filter(f => f.category.includes(q) || f.path.toLowerCase().includes(q))
    .map(f => ({
      title: f.path.split("/").pop()?.replace(/_/g, " ").replace(/\.\w+$/, "") || f.path,
      url: `${BASE}${f.path}`,
      category: f.category,
      format: f.path.endsWith(".xlsx") ? "XLSX" : f.path.endsWith(".pdf") ? "PDF" : "unknown",
    }));
}
