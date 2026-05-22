/**
 * Health Canada Fetcher — MapleSpike Pipeline
 *
 * Fetches Health Canada recall, advisory, and drug product data from
 * open.canada.ca CKAN and Health Canada APIs.
 */

import { httpGet } from '../../utils/http.js';
import { HEALTH_CANADA_SOURCES } from './constants.js';
import type { RawHealthCanadaRecord } from './types.js';

export interface FetchResult {
  /** Raw records from source */
  records: RawHealthCanadaRecord[];

  /** Source identifier */
  source: string;

  /** Any errors encountered */
  errors: string[];
}

/**
 * Fetch Health Canada food recalls from CKAN.
 */
export async function fetchHealthCanadaRecalls(options: {
  limit?: number;
  ckanPackageId?: string;
} = {}): Promise<FetchResult> {
  const result: FetchResult = {
    records: [],
    source: 'healthcanada-food-recalls',
    errors: [],
  };

  try {
    const baseUrl = 'https://open.canada.ca/data/api/3/action/package_show';
    const url = `${baseUrl}?id=${options.ckanPackageId || HEALTH_CANADA_SOURCES.foodRecalls.ckanPackageId}`;

    const response = await httpGet(url, { timeoutMs: 10000 });

    if (response.statusCode !== 200) {
      result.errors.push(`Failed to fetch package: ${response.statusCode}`);
      return result;
    }

    const data = await response.json() as any;

    if (!data.success || !data.result || !data.result.resources) {
      result.errors.push('Invalid CKAN response structure');
      return result;
    }

    const resources = data.result.resources;
    for (const resource of resources.slice(0, options.limit || 10)) {
      if (resource.url && resource.format === 'CSV') {
        try {
          const resourceResponse = await httpGet(resource.url, { timeoutMs: 15000 });
          if (resourceResponse.statusCode === 200) {
            const text = resourceResponse.body;
            const records = parseCSVRecords(text, resource.url);
            result.records.push(...records);
          }
        } catch (error) {
          result.errors.push(`Failed to fetch resource ${resource.id}: ${error}`);
        }
      }
    }
  } catch (error) {
    result.errors.push(`Fetch error: ${error}`);
  }

  return result;
}

/**
 * Simple CSV parser for Health Canada data.
 */
function parseCSVRecords(csvText: string, sourceUrl: string): RawHealthCanadaRecord[] {
  const records: RawHealthCanadaRecord[] = [];

  const lines = csvText.split('\n');
  if (lines.length < 2) {
    return records;
  }

  const headers = parseCSVLine(lines[0]);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);

    const record: RawHealthCanadaRecord = {
      url: sourceUrl,
    };

    for (let j = 0; j < headers.length && j < values.length; j++) {
      record[headers[j]] = values[j];
    }

    records.push(record);
  }

  return records;
}

/**
 * Parse a CSV line, handling quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());

  return result;
}

/**
 * Fetch from a specific CKAN package.
 */
export async function fetchFromCKANPackage(packageId: string): Promise<FetchResult> {
  const result: FetchResult = {
    records: [],
    source: `healthcanada-${packageId}`,
    errors: [],
  };

  try {
    const url = `https://open.canada.ca/data/api/3/action/package_show?id=${packageId}`;
    const response = await httpGet(url, { timeoutMs: 10000 });

    if (response.statusCode !== 200) {
      result.errors.push(`Failed to fetch package ${packageId}: ${response.statusCode}`);
      return result;
    }

    const data = await response.json() as any;

    if (!data.success || !data.result) {
      result.errors.push(`Invalid response for package ${packageId}`);
      return result;
    }

    result.source = data.result.name || packageId;

  } catch (error) {
    result.errors.push(`CKAN fetch error: ${error}`);
  }

  return result;
}