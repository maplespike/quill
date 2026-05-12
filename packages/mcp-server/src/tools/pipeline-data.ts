/**
 * Shared pipeline data loader for CivInt MCP search tools
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

let _pipelineData: Record<string, any> | null = null;

/**
 * Load and cache the pipeline-data.json file.
 * Tries multiple possible paths for flexibility across different run modes.
 */
export function getPipelineData(): Record<string, any> | null {
  if (_pipelineData) return _pipelineData;

  const __dirname = dirname(fileURLToPath(import.meta.url));

  // Try multiple possible relative paths (source vs compiled, dev vs production)
  const possiblePaths = [
    // From dist/tools/ or src/tools/ — go up to civint/, then into portal
    resolve(__dirname, '../../../../packages/portal/assets/pipeline-data.json'),
    // Alternative: from workspace root
    resolve('/data/projects/own/civint/packages/portal/assets/pipeline-data.json'),
  ];

  for (const dataPath of possiblePaths) {
    if (existsSync(dataPath)) {
      _pipelineData = JSON.parse(readFileSync(dataPath, 'utf-8'));
      return _pipelineData;
    }
  }

  return null;
}

/**
 * Search across one or more pipeline sources for records matching a query.
 * Performs case-insensitive substring matching on the JSON-serialized record.
 */
export function searchRecords(
  sourceKeys: string[],
  query: string,
  limit: number,
): { results: any[]; total: number } {
  const data = getPipelineData();
  if (!data) return { results: [], total: 0 };

  const allRecords: any[] = [];
  const q = query.toLowerCase();

  for (const key of sourceKeys) {
    const source = data.sources?.[key];
    if (source?.data && Array.isArray(source.data)) {
      for (const record of source.data) {
        const searchText = JSON.stringify(record).toLowerCase();
        if (searchText.includes(q)) {
          allRecords.push({ ...record, _source: key });
        }
      }
    }
  }

  return {
    results: allRecords.slice(0, limit),
    total: allRecords.length,
  };
}
