// SPDX-License-Identifier: AGPL-3.0-only
export type {
  ServiceRecord,
  ParsedServiceRecord,
  ServiceSearchOptions,
} from './types.js';
export { fetchServicesDirectory } from './fetcher.js';
export {
  parseIndigenousServicesDirectory,
  filterServiceRecords,
  normalizeProvince,
} from './parser.js';

/**
 * Main ingestion function for Indigenous Services Directory
 *
 * @param options - Search options (limit, province, category)
 * @returns Parsed service records
 */
export async function ingestServicesDirectory(
  options: { limit?: number; province?: string; category?: string } = {}
) {
  const { fetchServicesDirectory, parseIndigenousServicesDirectory, filterServiceRecords } = await import('./index.js');

  const raw = await fetchServicesDirectory();
  const parsed = await parseIndigenousServicesDirectory(JSON.stringify(raw));
  const filtered = filterServiceRecords(parsed, options);

  return options.limit ? filtered.slice(0, options.limit) : filtered;
}

/**
 * Search services by province
 */
export async function searchServicesByProvince(
  province: string,
  options: { limit?: number } = {}
) {
  return ingestServicesDirectory({ ...options, province });
}

/**
 * Search services by category
 */
export async function searchServicesByCategory(
  category: string,
  options: { limit?: number } = {}
) {
  return ingestServicesDirectory({ ...options, category });
}