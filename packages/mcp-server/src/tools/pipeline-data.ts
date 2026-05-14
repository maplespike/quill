/**
 * Shared pipeline data loader for MapleSpike MCP search tools
 *
 * Thin wrapper around api-client.ts — all data access goes through
 * the unified API client.
 *
 * Kept as a separate module for backward compatibility with existing
 * search tool imports. New tools should import from api-client.ts directly.
 */
export {
  searchLocalRecords,
  getPipelineReleases,
  searchGovData,
  getCitation,
} from './api-client.js';

/** Load and cache the pipeline-data.json file */
export function getPipelineData(): Record<string, any> | null {
  const { existsSync, readFileSync } = require('fs');
  const { resolve, dirname } = require('path');
  const __dirname = dirname(require('url').fileURLToPath(import.meta.url));

  const possiblePaths = [
    resolve(__dirname, '../../../../packages/portal/assets/pipeline-data.json'),
    resolve('/data/projects/own/maplespike/packages/portal/assets/pipeline-data.json'),
  ];

  for (const dataPath of possiblePaths) {
    if (existsSync(dataPath)) {
      try { return JSON.parse(readFileSync(dataPath, 'utf-8')); } catch { return null; }
    }
  }
  return null;
}

/** Search records with live-fetch fallback (backward compat) */
export function searchRecords(
  sourceKeys: string[],
  query: string,
  limit: number,
): { results: any[]; total: number } {
  const { searchLocalRecords } = require('./api-client.js');
  return searchLocalRecords(sourceKeys, query, limit);
}

/** Live-fetch fallback when local data is unavailable (backward compat) */
export async function liveFetch(
  sourceKeys: string[],
  query: string,
  limit: number,
): Promise<{ results: any[]; total: number }> {
  const { searchLocalRecords, searchGovData } = require('./api-client.js');
  // Try local data first
  const local = searchLocalRecords(sourceKeys, query, limit);
  if (local.total > 0) return local;
  // Fall back to API search
  try {
    const apiResult = await searchGovData(query, 'all', limit);
    return { results: apiResult.results || [], total: apiResult.total || 0 };
  } catch {
    return { results: [], total: 0 };
  }
}
