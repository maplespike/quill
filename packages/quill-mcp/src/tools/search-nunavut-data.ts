// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_nunavut_data',
  description: 'Search government data about Nunavut from federal CKAN, Statistics Canada, and the Nunavut Bureau of Statistics.',
  inputSchema: { type: 'object', properties: {
    query: { type: 'string', maxLength: 2000, description: 'Search terms' },
    limit: { type: 'number', minimum: 1, maximum: 50 },
  }, required: ['query'] },
};

// Nunavut Bureau of Statistics known data files (mirrored from pipeline-core
// nu-bureau-statistics module to avoid importing pipeline-core directly).
// Source: https://www.gov.nu.ca/sites/default/files/documents/
const BUREAU_BASE = 'https://www.gov.nu.ca';
const BUREAU_DATA_FILES: { path: string; category: string }[] = [
  { path: '/sites/default/files/documents/2025-03/Nunavut_Deaths_by_Sex__Age_Group__Marital_Status_and_by_Month__2007_to_2023__4_tables_.xlsx', category: 'demographics' },
  { path: '/sites/default/files/documents/2024-09/Nunavut_Population_Estimates_by_Marital_Status_and_Age_Groups_2005_to_2022_Dissemination_file.xlsx', category: 'population' },
  { path: '/sites/default/files/documents/2022-11/nunavut_secondary_school_graduates_1999_to_2018_2_tables.xlsx', category: 'education' },
  { path: '/sites/default/files/documents/2025-04/Consumer_Price_Index_Report__March_2025.pdf', category: 'economic' },
];

interface BureauResult {
  title: string;
  url: string;
  category: string;
  format: string;
  source: string;
}

/** Search known Nunavut Bureau of Statistics data files by keyword. */
function searchBureauFiles(query: string): BureauResult[] {
  const q = query.toLowerCase();
  return BUREAU_DATA_FILES
    .filter(f => f.category.includes(q) || f.path.toLowerCase().includes(q))
    .map(f => ({
      title: f.path.split('/').pop()?.replace(/_/g, ' ').replace(/\.\w+$/, '') ?? f.path,
      url: `${BUREAU_BASE}${f.path}`,
      category: f.category,
      format: f.path.endsWith('.xlsx') ? 'XLSX' : f.path.endsWith('.pdf') ? 'PDF' : 'unknown',
      source: 'Nunavut Bureau of Statistics',
    }));
}

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '').trim();
  const limit = Math.min((args.limit as number) ?? 10, 50);
  if (!query) return { content: { tool: 'search_nunavut_data', error: 'No query' }, isError: true };

  // Federal CKAN results
  let federalResults: Record<string, unknown>[] = [];
  let federalTotal = 0;
  let federalError: string | undefined;
  try {
    const { results, total } = await searchCkan(query + ' Nunavut', limit);
    federalResults = results.map(r => ({ ...r, source: 'federal CKAN (open.canada.ca)' }));
    federalTotal = total;
  } catch (error) {
    federalError = (error as Error).message;
  }

  // Nunavut Bureau of Statistics results
  const bureauResults = searchBureauFiles(query);

  // Merge results: bureau results first (guaranteed visibility), then federal
  // results filling up to the limit. A "source" field distinguishes the two.
  const federalSlots = Math.max(0, limit - bureauResults.length);
  const mergedResults = [
    ...bureauResults,
    ...federalResults.slice(0, federalSlots),
  ];
  const totalCount = federalTotal + bureauResults.length;

  return {
    content: {
      tool: 'search_nunavut_data',
      query,
      results: mergedResults,
      totalCount,
      sources: {
        federalCkan: federalError ? { status: 'error', error: federalError } : { status: 'ok', count: federalTotal },
        bureauOfStatistics: { status: 'ok', count: bureauResults.length },
      },
    },
  };
};
